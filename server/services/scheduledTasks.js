const cron = require('node-cron');
const { getDB } = require('../config/database');

// 刪除超過時間的預約
const cleanupExpiredBookings = () => {
  console.log('🧹 開始清理過期預約...');
  
  const db = getDB();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24小時前

  // 刪除已完成超過24小時的預約
  db.run(
    `DELETE FROM bookings 
     WHERE status = 'completed' 
     AND end_time < ?`,
    [oneDayAgo.toISOString()],
    function(err) {
      if (err) {
        console.error('清理已完成預約失敗:', err);
      } else {
        console.log(`✅ 清理了 ${this.changes} 個已完成的預約`);
      }
    }
  );

  // 刪除已取消超過7天的預約
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  db.run(
    `DELETE FROM bookings 
     WHERE status = 'cancelled' 
     AND updated_at < ?`,
    [sevenDaysAgo.toISOString()],
    function(err) {
      if (err) {
        console.error('清理已取消預約失敗:', err);
      } else {
        console.log(`✅ 清理了 ${this.changes} 個已取消的預約`);
      }
    }
  );

  // 自動取消過期未開始的預約（開始時間已過30分鐘且狀態仍為confirmed）
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  db.run(
    `UPDATE bookings 
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
     WHERE status = 'confirmed' 
     AND start_time < ?`,
    [thirtyMinutesAgo.toISOString()],
    function(err) {
      if (err) {
        console.error('自動取消過期預約失敗:', err);
      } else if (this.changes > 0) {
        console.log(`✅ 自動取消了 ${this.changes} 個過期預約`);
      }
    }
  );
};

// 設置機器鎖定狀態（預約前1小時到後30分鐘）
const setMachineLockStatus = () => {
  console.log('🔒 檢查需要鎖定的機器...');
  
  const db = getDB();
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000); // 1小時後

  // 查找在鎖定期間內的預約
  db.all(
    `SELECT DISTINCT b.machine_id, m.machine_code, b.start_time, b.end_time
     FROM bookings b
     JOIN machines m ON b.machine_id = m.id
     WHERE b.status = 'confirmed'
     AND (
       (b.start_time <= ? AND b.start_time > ?) OR
       (? >= datetime(b.start_time, '-1 hour') AND ? <= datetime(b.end_time, '+30 minutes'))
     )
     AND m.status != 'maintenance'`,
    [oneHourLater.toISOString(), now.toISOString(), now.toISOString(), now.toISOString()],
    (err, bookings) => {
      if (err) {
        console.error('查詢需要鎖定的機器失敗:', err);
        return;
      }

      bookings.forEach(booking => {
        // 設置機器為鎖定狀態
        db.run(
          'UPDATE machines SET status = "locked", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != "maintenance"',
          [booking.machine_id],
          function(err) {
            if (err) {
              console.error(`設置機器 ${booking.machine_code} 為鎖定狀態失敗:`, err);
            } else if (this.changes > 0) {
              console.log(`🔒 機器 ${booking.machine_code} 已設置為鎖定狀態`);
            }
          }
        );
      });
    }
  );
};

// 檢查並更新過期的進行中預約
const updateOverdueBookings = () => {
  console.log('🔍 檢查過期的進行中預約...');
  
  const db = getDB();
  const now = new Date();

  // 查找已經結束但狀態仍為進行中的預約
  db.all(
    `SELECT b.*, m.machine_code
     FROM bookings b
     JOIN machines m ON b.machine_id = m.id
     WHERE b.status = 'in_progress'
     AND b.end_time < ?`,
    [now.toISOString()],
    (err, bookings) => {
      if (err) {
        console.error('查詢過期進行中預約失敗:', err);
        return;
      }

      bookings.forEach(booking => {
        // 更新預約狀態為已完成
        db.run(
          'UPDATE bookings SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [booking.id],
          (err) => {
            if (err) {
              console.error(`更新預約 ${booking.id} 狀態失敗:`, err);
            } else {
              console.log(`✅ 預約 ${booking.id} 已自動標記為完成`);
            }
          }
        );

        // 更新機器狀態為可用
        db.run(
          'UPDATE machines SET status = "available", current_user_id = NULL, start_time = NULL, end_time = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [booking.machine_id],
          (err) => {
            if (err) {
              console.error(`重置機器 ${booking.machine_code} 狀態失敗:`, err);
            } else {
              console.log(`✅ 機器 ${booking.machine_code} 已重置為可用狀態`);
            }
          }
        );
      });
    }
  );
};

// 啟動所有定時任務
const startScheduledTasks = () => {
  console.log('🚀 啟動定時任務服務...');

  // 每天凌晨2點清理過期預約
  cron.schedule('0 2 * * *', () => {
    console.log('🕑 執行每日清理任務...');
    cleanupExpiredBookings();
  });

  // 每10分鐘檢查機器鎖定狀態
  cron.schedule('*/10 * * * *', () => {
    setMachineLockStatus();
  });

  // 每5分鐘檢查過期的進行中預約
  cron.schedule('*/5 * * * *', () => {
    updateOverdueBookings();
  });

  console.log('✅ 定時任務已啟動');
  console.log('- 每日凌晨2點：清理過期預約');
  console.log('- 每10分鐘：檢查機器待命狀態');
  console.log('- 每5分鐘：檢查過期的進行中預約');
};

module.exports = {
  startScheduledTasks,
  cleanupExpiredBookings,
  setMachineLockStatus,
  updateOverdueBookings
};
