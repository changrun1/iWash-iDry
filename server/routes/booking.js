const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 獲取用戶週預約限制
router.get('/weekly-limits', authMiddleware, (req, res) => {
  const db = getDB();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // 設定為週日
  const weekStartStr = weekStart.toISOString().split('T')[0];

  db.get(
    'SELECT washing_count, drying_count FROM weekly_booking_limits WHERE user_id = ? AND week_start = ?',
    [req.user.id, weekStartStr],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: '獲取週預約限制失敗' });
      }

      const washingCount = row ? row.washing_count : 0;
      const dryingCount = row ? row.drying_count : 0;

      res.json({
        washing_count: washingCount,
        drying_count: dryingCount,
        washing_limit: 2,
        drying_limit: 2,
        week_start: weekStartStr
      });
    }
  );
});

// 獲取用戶的預約記錄
router.get('/my-bookings', authMiddleware, (req, res) => {
  const db = getDB();
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      b.*,
      m.machine_code,
      m.machine_type,
      m.location
    FROM bookings b
    JOIN machines m ON b.machine_id = m.id
    WHERE b.user_id = ?
  `;
  
  const params = [req.user.id];

  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }

  query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, bookings) => {
    if (err) {
      return res.status(500).json({ message: '獲取預約記錄失敗' });
    }

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.length
      }
    });
  });
});

// 檢查週預約限制
const checkWeeklyLimit = (userId, machineType, bookingDate, callback) => {
  const db = getDB();
  const weekStart = new Date(bookingDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 設定為週日
  const weekStartStr = weekStart.toISOString().split('T')[0];

  db.get(
    'SELECT washing_count, drying_count FROM weekly_booking_limits WHERE user_id = ? AND week_start = ?',
    [userId, weekStartStr],
    (err, row) => {
      if (err) {
        return callback(err, null);
      }

      const washingCount = row ? row.washing_count : 0;
      const dryingCount = row ? row.drying_count : 0;
      
      callback(null, { 
        washingCount, 
        dryingCount, 
        weekStart: weekStartStr 
      });
    }
  );
};

// 更新週預約限制
const updateWeeklyLimit = (userId, machineType, weekStart, increment = 1) => {
  const db = getDB();
  
  const columnName = machineType === 'washer' ? 'washing_count' : 'drying_count';
  
  db.run(
    `INSERT INTO weekly_booking_limits (user_id, week_start, ${columnName}) 
     VALUES (?, ?, ?) 
     ON CONFLICT(user_id, week_start) 
     DO UPDATE SET ${columnName} = ${columnName} + ?, updated_at = CURRENT_TIMESTAMP`,
    [userId, weekStart, increment, increment]
  );
};

// 創建預約
router.post('/create', authMiddleware, [
  body('machine_id').isInt().withMessage('請選擇有效的洗衣機'),
  body('booking_date').isISO8601().withMessage('請選擇有效的日期'),
  body('start_time').isISO8601().withMessage('請選擇有效的開始時間'),
  body('duration').isInt({ min: 30, max: 180 }).withMessage('使用時間需在30-180分鐘之間')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入資料有誤', 
        errors: errors.array() 
      });
    }

    const { machine_id, booking_date, start_time, duration } = req.body;
    const db = getDB();

    // 計算結束時間
    const startDateTime = new Date(start_time);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    // 檢查週預約限制
    checkWeeklyLimit(req.user.id, machine_id, booking_date, (err, limitInfo) => {
      if (err) {
        return res.status(500).json({ message: '檢查預約限制失敗' });
      }

      // 檢查洗衣機類型並驗證限制
      db.get(
        'SELECT * FROM machines WHERE id = ? AND status = "available"',
        [machine_id],
        (err, machine) => {
          if (err) {
            return res.status(500).json({ message: '檢查洗衣機狀態失敗' });
          }

          if (!machine) {
            return res.status(400).json({ message: '洗衣機不可用' });
          }

          // 檢查預約限制
          if (machine.machine_type === 'washer' && limitInfo.washingCount >= 2) {
            return res.status(400).json({ 
              message: '每週最多只能預約洗衣機2次，您本週已預約' + limitInfo.washingCount + '次' 
            });
          }
          
          if (machine.machine_type === 'dryer' && limitInfo.dryingCount >= 2) {
            return res.status(400).json({ 
              message: '每週最多只能預約烘衣機2次，您本週已預約' + limitInfo.dryingCount + '次' 
            });
          }

          // 檢查時間衝突
          db.get(
            `SELECT * FROM bookings 
             WHERE machine_id = ? 
             AND status IN ('confirmed', 'in_progress') 
             AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))`,
            [machine_id, start_time, start_time, endDateTime.toISOString(), endDateTime.toISOString()],
            (err, conflict) => {
              if (err) {
                return res.status(500).json({ message: '檢查時間衝突失敗' });
              }

              if (conflict) {
                return res.status(400).json({ message: '該時段已被預約' });
              }

              // 創建預約
              const paymentAmount = machine.machine_type === 'washing' ? 30 : 20; // 洗衣30元，烘衣20元
              const accessCode = Math.floor(100000 + Math.random() * 900000).toString(); // 生成六位數密碼

              db.run(
                `INSERT INTO bookings 
                 (user_id, machine_id, booking_date, start_time, end_time, payment_amount, access_code, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
                [req.user.id, machine_id, booking_date, start_time, endDateTime.toISOString(), paymentAmount, accessCode],
                function(err) {
                  if (err) {
                    return res.status(500).json({ message: '創建預約失敗' });
                  }

                  // 更新週預約限制
                  updateWeeklyLimit(req.user.id, machine.machine_type, limitInfo.weekStart, 1);

                  res.status(201).json({
                    message: '預約成功',
                    booking: {
                      id: this.lastID,
                      machine_code: machine.machine_code,
                      machine_type: machine.machine_type,
                      location: machine.location,
                      start_time,
                      end_time: endDateTime.toISOString(),
                      payment_amount: paymentAmount,
                      access_code: accessCode,
                      status: 'confirmed'
                    }
                  });
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    res.status(500).json({ message: '創建預約失敗', error: error.message });
  }
});

// 取消預約
router.put('/:bookingId/cancel', authMiddleware, (req, res) => {
  const { bookingId } = req.params;
  const db = getDB();

  // 檢查預約是否存在且屬於當前用戶
  db.get(
    'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
    [bookingId, req.user.id],
    (err, booking) => {
      if (err) {
        return res.status(500).json({ message: '檢查預約失敗' });
      }

      if (!booking) {
        return res.status(404).json({ message: '預約不存在' });
      }

      if (booking.status === 'in_progress') {
        return res.status(400).json({ message: '進行中的預約無法取消' });
      }

      if (booking.status === 'completed') {
        return res.status(400).json({ message: '已完成的預約無法取消' });
      }

      // 檢查是否可以取消（開始時間前30分鐘）
      const startTime = new Date(booking.start_time);
      const now = new Date();
      const timeDiff = startTime.getTime() - now.getTime();

      if (timeDiff < 30 * 60 * 1000) { // 30分鐘 = 30 * 60 * 1000 毫秒
        return res.status(400).json({ message: '開始時間前30分鐘內無法取消預約' });
      }

      // 取消預約
      db.run(
        'UPDATE bookings SET status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [bookingId],
        function(err) {
          if (err) {
            return res.status(500).json({ message: '取消預約失敗' });
          }

          // 更新週預約限制（減少計數）
          db.get('SELECT machine_type FROM machines WHERE id = ?', [booking.machine_id], (err, machine) => {
            if (!err && machine) {
              const weekStart = new Date(booking.booking_date);
              weekStart.setDate(weekStart.getDate() - weekStart.getDay());
              const weekStartStr = weekStart.toISOString().split('T')[0];
              updateWeeklyLimit(req.user.id, machine.machine_type, weekStartStr, -1);
            }
          });

          res.json({ message: '預約已取消' });
        }
      );
    }
  );
});

// 獲取可用時段
router.get('/available-slots', authMiddleware, (req, res) => {
  const { machine_id, date } = req.query;
  
  if (!machine_id || !date) {
    return res.status(400).json({ message: '請提供洗衣機ID和日期' });
  }

  const db = getDB();
  
  // 獲取該洗衣機在指定日期的預約
  db.all(
    `SELECT start_time, end_time FROM bookings 
     WHERE machine_id = ? 
     AND DATE(start_time) = ? 
     AND status IN ('confirmed', 'in_progress')
     ORDER BY start_time`,
    [machine_id, date],
    (err, bookings) => {
      if (err) {
        return res.status(500).json({ message: '獲取預約資料失敗' });
      }

      // 生成可用時段（7:00-23:30）
      const availableSlots = [];
      const startHour = 7;
      const endHour = 24; // 到23:30，所以需要包含23點
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          // 如果是23:30之後，就停止生成時段
          if (hour === 23 && minute > 30) {
            break;
          }
          
          const slotStart = new Date(date + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00');
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1小時後

          // 檢查是否與現有預約衝突
          const hasConflict = bookings.some(booking => {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            return (slotStart < bookingEnd && slotEnd > bookingStart);
          });

          if (!hasConflict && slotStart > new Date()) { // 只顯示未來的時段
            availableSlots.push({
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString()
            });
          }
        }
      }

      res.json({ available_slots: availableSlots });
    }
  );
});

module.exports = router;
