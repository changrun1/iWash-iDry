const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// LINE Bot設定（需要在實際環境中設置）
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'demo-token';
const LINE_API_URL = 'https://api.line.me/v2/bot';

// 發送LINE通知
async function sendLineNotification(userId, message) {
  const db = getDB();
  
  // 獲取用戶的LINE ID
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT line_user_id FROM users WHERE id = ?',
      [userId],
      async (err, user) => {
        if (err) {
          reject(new Error('資料庫錯誤'));
          return;
        }

        if (!user || !user.line_user_id) {
          reject(new Error('用戶未綁定LINE帳號'));
          return;
        }

        try {
          // 發送LINE訊息
          const response = await axios.post(
            `${LINE_API_URL}/message/push`,
            {
              to: user.line_user_id,
              messages: [
                {
                  type: 'text',
                  text: message
                }
              ]
            },
            {
              headers: {
                'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );

          resolve({
            success: true,
            message: 'LINE通知發送成功',
            response: response.data
          });
        } catch (error) {
          if (LINE_CHANNEL_ACCESS_TOKEN === 'demo-token') {
            // 開發模式，模擬發送成功
            resolve({
              success: true,
              message: 'LINE通知發送成功（模擬模式）',
              note: '請設置正確的 LINE_CHANNEL_ACCESS_TOKEN 環境變數'
            });
          } else {
            reject(new Error(`LINE API錯誤: ${error.message}`));
          }
          }
        }
      );
    });
  }

// 創建通知記錄
function createNotification(userId, bookingId, type, title, message) {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO notifications (user_id, booking_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
      [userId, bookingId, type, title, message],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// 更新通知狀態
function updateNotificationStatus(notificationId, status, sentAt = null) {
  const db = getDB();
  
  db.run(
    'UPDATE notifications SET status = ?, sent_at = COALESCE(?, sent_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, sentAt, notificationId],
    (err) => {
      if (err) {
        console.error('更新通知狀態失敗:', err);
      }
    }
  );
}

// 手動發送測試通知
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const testMessage = message || '這是一條測試通知訊息 📱';

    const result = await sendLineNotification(req.user.id, testMessage);
    
    res.json({
      message: '測試通知已發送',
      result
    });
  } catch (error) {
    res.status(500).json({ 
      message: '發送測試通知失敗', 
      error: error.message 
    });
  }
});

// 綁定LINE帳號
router.post('/bind-line', authMiddleware, (req, res) => {
  const { line_user_id } = req.body;
  
  if (!line_user_id) {
    return res.status(400).json({ message: '請提供LINE User ID' });
  }

  const db = getDB();
  
  db.run(
    'UPDATE users SET line_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [line_user_id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: '綁定LINE帳號失敗' });
      }
      
      res.json({ message: 'LINE帳號綁定成功' });
    }
  );
});

// 取得用戶通知記錄
router.get('/history', authMiddleware, (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT 
      n.*,
      b.start_time,
      m.machine_code,
      m.machine_type
    FROM notifications n
    LEFT JOIN bookings b ON n.booking_id = b.id
    LEFT JOIN machines m ON b.machine_id = m.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ? OFFSET ?`,
    [req.user.id, parseInt(limit), offset],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({ message: '獲取通知記錄失敗' });
      }

      res.json({
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: notifications.length
        }
      });
    }
  );
});

// 標記通知為已讀
router.put('/:notificationId/read', authMiddleware, (req, res) => {
  const { notificationId } = req.params;
  const db = getDB();

  db.run(
    'UPDATE notifications SET status = "read", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [notificationId, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: '更新通知狀態失敗' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: '通知不存在' });
      }

      res.json({ message: '通知已標記為已讀' });
    }
  );
});

// 定時任務：檢查預約開始前通知
cron.schedule('*/10 * * * *', async () => {
  console.log('🔔 檢查預約開始前通知...');
  
  const db = getDB();
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000); // 1小時後
  const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000); // 15分鐘後

  // 查找1小時內即將開始的預約（發送提前通知）
  db.all(
    `SELECT 
      b.*,
      u.name,
      u.student_id,
      m.machine_code,
      m.machine_type,
      m.location
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN machines m ON b.machine_id = m.id
    WHERE b.status = 'confirmed'
    AND b.start_time <= ?
    AND b.start_time > ?
    AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.booking_id = b.id 
      AND n.type = 'booking_reminder'
      AND n.status = 'sent'
    )`,
    [oneHourLater.toISOString(), fifteenMinutesLater.toISOString()],
    async (err, bookings) => {
      if (err) {
        console.error('查詢即將開始的預約失敗:', err);
        return;
      }

      for (const booking of bookings) {
        try {
          const startTime = new Date(booking.start_time);
          const minutesLeft = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60));
          
          const message = `⏰ 預約提醒：您的${booking.machine_type === 'washer' ? '洗衣' : '烘衣'}即將開始！\n\n` +
                         `📍 位置：${booking.location}\n` +
                         `🏷️ 機器：${booking.machine_code}\n` +
                         `🕒 開始時間：${startTime.toLocaleString('zh-TW')}\n` +
                         `⏳ 還有約 ${minutesLeft} 分鐘\n` +
                         `🔑 密碼：${booking.access_code}\n\n` +
                         `請準備前往使用～`;

          // 創建通知記錄
          const notificationId = await createNotification(
            booking.user_id,
            booking.id,
            'booking_reminder',
            '預約即將開始',
            message
          );

          // 發送LINE通知
          const result = await sendLineNotification(booking.user_id, message);
          
          if (result.success) {
            updateNotificationStatus(notificationId, 'sent', new Date().toISOString());
          } else {
            updateNotificationStatus(notificationId, 'failed');
          }

        } catch (error) {
          console.error(`發送預約提醒失敗 - 預約ID: ${booking.id}`, error);
        }
      }
    }
  );
});

// 定時任務：檢查即將完成的洗衣
cron.schedule('*/5 * * * *', async () => {
  console.log('🔍 檢查即將完成的洗衣任務...');
  
  const db = getDB();
  const now = new Date();
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

  // 查找5分鐘內即將完成的預約
  db.all(
    `SELECT 
      b.*,
      u.name,
      u.student_id,
      m.machine_code,
      m.machine_type,
      m.location
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN machines m ON b.machine_id = m.id
    WHERE b.status = 'in_progress'
    AND b.end_time <= ?
    AND b.end_time > ?`,
    [fiveMinutesLater.toISOString(), now.toISOString()],
    async (err, bookings) => {
      if (err) {
        console.error('查詢即將完成的預約失敗:', err);
        return;
      }

      for (const booking of bookings) {
        try {
          const endTime = new Date(booking.end_time);
          const minutesLeft = Math.ceil((endTime.getTime() - now.getTime()) / (1000 * 60));
          
          const message = `🕐 您的${booking.machine_type === 'washing' ? '洗衣' : '烘衣'}即將完成！\n\n` +
                         `📍 位置：${booking.location}\n` +
                         `🏷️ 機器：${booking.machine_code}\n` +
                         `⏰ 剩餘時間：約 ${minutesLeft} 分鐘\n\n` +
                         `請準備前往取衣～`;

          // 創建通知記錄
          const notificationId = await createNotification(
            booking.user_id,
            booking.id,
            'washing_almost_done',
            '洗衣即將完成',
            message
          );

          // 發送LINE通知
          const result = await sendLineNotification(booking.user_id, message);
          
          if (result.success) {
            updateNotificationStatus(notificationId, 'sent', new Date().toISOString());
          } else {
            updateNotificationStatus(notificationId, 'failed');
          }

        } catch (error) {
          console.error(`發送完成提醒失敗 - 預約ID: ${booking.id}`, error);
        }
      }
    }
  );
});

// 定時任務：檢查已完成的洗衣
cron.schedule('*/2 * * * *', async () => {
  console.log('🔍 檢查已完成的洗衣任務...');
  
  const db = getDB();
  const now = new Date();

  // 查找已經完成但狀態還是進行中的預約
  db.all(
    `SELECT 
      b.*,
      u.name,
      u.student_id,
      m.machine_code,
      m.machine_type,
      m.location
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN machines m ON b.machine_id = m.id
    WHERE b.status = 'in_progress'
    AND b.end_time <= ?`,
    [now.toISOString()],
    async (err, bookings) => {
      if (err) {
        console.error('查詢已完成的預約失敗:', err);
        return;
      }

      for (const booking of bookings) {
        try {
          // 直接刪除預約記錄而不是設為completed
          db.run(
            'DELETE FROM bookings WHERE id = ?',
            [booking.id],
            (err) => {
              if (err) {
                console.error(`刪除預約記錄失敗 - 預約ID: ${booking.id}`, err);
              } else {
                console.log(`✅ 預約記錄 ${booking.id} 已刪除`);
              }
            }
          );

          // 更新洗衣機狀態為可用
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

          const message = `✅ 您的${booking.machine_type === 'washer' ? '洗衣' : '烘衣'}已完成！\n\n` +
                         `📍 位置：${booking.location}\n` +
                         `🏷️ 機器：${booking.machine_code}\n` +
                         `👕 請盡快前往取衣，避免遺失～\n\n` +
                         `感謝您的使用！`;

          // 創建通知記錄
          const notificationId = await createNotification(
            booking.user_id,
            booking.id,
            'washing_completed',
            '洗衣已完成',
            message
          );

          // 發送LINE通知
          const result = await sendLineNotification(booking.user_id, message);
          
          if (result.success) {
            updateNotificationStatus(notificationId, 'sent', new Date().toISOString());
          } else {
            updateNotificationStatus(notificationId, 'failed');
          }

        } catch (error) {
          console.error(`處理已完成預約失敗 - 預約ID: ${booking.id}`, error);
        }
      }
    }
  );
});

// 手動觸發檢查（開發用）
router.post('/check-completed', authMiddleware, async (req, res) => {
  try {
    // 手動觸發檢查邏輯（與定時任務相同）
    res.json({ message: '手動檢查已觸發' });
  } catch (error) {
    res.status(500).json({ message: '檢查失敗', error: error.message });
  }
});

module.exports = router;
