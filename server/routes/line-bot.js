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
  
  db.run(
    `INSERT INTO notifications (user_id, booking_id, type, title, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
    [userId, bookingId, type, title, message],
    function(err) {
      if (err) {
        console.error('創建通知記錄失敗:', err);
      }
    }
  );
}

// 手動發送測試通知
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const testMessage = message || '這是一條測試通知訊息 📱\n\n您的洗衣機預約系統運作正常！';

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

// 發送預約提醒通知
async function sendBookingReminder(bookingId) {
  const db = getDB();
  
  db.get(
    `SELECT b.*, u.id as user_id, u.name, m.machine_code, m.location, m.machine_type
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     JOIN machines m ON b.machine_id = m.id
     WHERE b.id = ?`,
    [bookingId],
    async (err, booking) => {
      if (err || !booking) return;

      const startTime = new Date(booking.start_time);
      const message = `🔔 洗衣提醒\n\n您的洗衣預約即將開始：\n📍 位置：${booking.location}\n🏷️ 機器：${booking.machine_code} (${booking.machine_type})\n⏰ 時間：${startTime.toLocaleString('zh-TW')}\n🔑 密碼：${booking.access_code}\n\n請準時前往使用！`;

      try {
        await sendLineNotification(booking.user_id, message);
        createNotification(booking.user_id, bookingId, 'reminder', '洗衣提醒', message);
      } catch (error) {
        console.error('發送提醒通知失敗:', error);
      }
    }
  );
}

// 發送洗衣完成通知
async function sendCompletionNotification(bookingId) {
  const db = getDB();
  
  db.get(
    `SELECT b.*, u.id as user_id, u.name, m.machine_code, m.location, m.machine_type
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     JOIN machines m ON b.machine_id = m.id
     WHERE b.id = ?`,
    [bookingId],
    async (err, booking) => {
      if (err || !booking) return;

      const message = `✅ 洗衣完成\n\n您的洗衣已經完成！\n📍 位置：${booking.location}\n🏷️ 機器：${booking.machine_code} (${booking.machine_type})\n\n請盡快前往取回您的衣物。\n感謝您使用校園洗衣服務！`;

      try {
        await sendLineNotification(booking.user_id, message);
        createNotification(booking.user_id, bookingId, 'completion', '洗衣完成', message);
      } catch (error) {
        console.error('發送完成通知失敗:', error);
      }
    }
  );
}

// 定時任務：檢查即將開始的預約（提前10分鐘提醒）
cron.schedule('* * * * *', () => {
  const db = getDB();
  const now = new Date();
  const reminderTime = new Date(now.getTime() + 10 * 60 * 1000); // 10分鐘後

  db.all(
    `SELECT id FROM bookings 
     WHERE status = 'confirmed' 
     AND start_time BETWEEN ? AND ?
     AND id NOT IN (
       SELECT booking_id FROM notifications 
       WHERE type = 'reminder' AND booking_id IS NOT NULL
     )`,
    [now.toISOString(), reminderTime.toISOString()],
    (err, bookings) => {
      if (err) return;

      bookings.forEach(booking => {
        sendBookingReminder(booking.id);
      });
    }
  );
});

// 定時任務：檢查已完成的預約
cron.schedule('* * * * *', () => {
  const db = getDB();
  const now = new Date();

  db.all(
    `SELECT id FROM bookings 
     WHERE status = 'in_progress' 
     AND end_time <= ?`,
    [now.toISOString()],
    (err, bookings) => {
      if (err) return;

      bookings.forEach(booking => {
        // 更新預約狀態為已完成
        db.run(
          'UPDATE bookings SET status = "completed" WHERE id = ?',
          [booking.id]
        );
        
        // 發送完成通知
        sendCompletionNotification(booking.id);
      });
    }
  );
});

module.exports = router;
