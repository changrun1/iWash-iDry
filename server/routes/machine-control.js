const express = require('express');
const crypto = require('crypto');
const { getDB } = require('../config/database');

const router = express.Router();

// 機器控制API密鑰驗證中間件
const validateMachineApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key') || req.body.api_key;
  const validApiKey = process.env.MACHINE_API_KEY || 'demo-machine-api-key-change-in-production';

  if (apiKey !== validApiKey) {
    return res.status(401).json({ 
      success: false, 
      message: '無效的API密鑰' 
    });
  }
  next();
};

// 生成六位數密碼
function generateAccessCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 機器狀態更新端點（Arduino調用）
router.post('/status-update', validateMachineApiKey, (req, res) => {
  const { machines } = req.body;

  if (!Array.isArray(machines)) {
    return res.status(400).json({
      success: false,
      message: 'machines必須是陣列格式'
    });
  }

  const db = getDB();
  const responses = [];

  // 處理每台機器的狀態更新
  machines.forEach(machineData => {
    const { machine_code, status, remaining_time } = machineData;

    if (!machine_code) {
      responses.push({
        machine_code: machine_code || 'unknown',
        success: false,
        message: '缺少機器代碼'
      });
      return;
    }

    // 獲取機器信息和當前預約
    db.get(
      `SELECT m.*, b.id as booking_id, b.user_id, b.start_time, b.end_time, b.access_code
       FROM machines m
       LEFT JOIN bookings b ON m.id = b.machine_id 
         AND b.status = 'confirmed' 
         AND datetime('now') BETWEEN b.start_time AND b.end_time
       WHERE m.machine_code = ?`,
      [machine_code],
      (err, machine) => {
        if (err) {
          responses.push({
            machine_code,
            success: false,
            message: '資料庫錯誤'
          });
          return;
        }

        if (!machine) {
          responses.push({
            machine_code,
            success: false,
            message: '機器不存在'
          });
          return;
        }

        const now = new Date();
        let shouldLock = false;
        let accessCode = null;
        let message = '機器可用';
        let machineStatus = 'available';

        // 優先級1: 維修狀態（最高優先級）
        if (machine.status === 'maintenance') {
          shouldLock = true;
          message = '機器維修中';
          machineStatus = 'maintenance';
        }
        // 優先級2: 檢查是否在鎖定期間
        else if (machine.booking_id) {
          const startTime = new Date(machine.start_time);
          const endTime = new Date(machine.end_time);
          const oneHourBeforeStart = new Date(startTime.getTime() - 60 * 60 * 1000);
          const halfHourAfterEnd = new Date(endTime.getTime() + 30 * 60 * 1000);

          // 在鎖定期間（預約前1小時到後30分鐘）
          if (now >= oneHourBeforeStart && now <= halfHourAfterEnd) {
            shouldLock = true;
            machineStatus = 'locked';
            
            // 生成或取得密碼
            accessCode = machine.access_code;
            if (!accessCode) {
              accessCode = generateAccessCode();
              db.run(
                'UPDATE bookings SET access_code = ? WHERE id = ?',
                [accessCode, machine.booking_id]
              );
            }

            // 根據時間段提供不同訊息
            if (now < startTime) {
              message = `預約將於 ${startTime.toLocaleTimeString()} 開始，機器已鎖定`;
            } else if (now >= startTime && now <= endTime) {
              message = `預約時間內，機器已鎖定，請使用密碼：${accessCode}`;
            } else {
              message = `預約已結束，整理時間中，機器暫時鎖定`;
            }
          }
          // 鎖定期間已結束，清理預約
          else if (now > halfHourAfterEnd) {
            shouldLock = false;
            message = '預約已清理，機器可用';
            machineStatus = 'available';

            // 清理過期預約
            db.run('DELETE FROM bookings WHERE id = ?', [machine.booking_id]);
            db.run(
              'UPDATE machines SET current_user_id = NULL WHERE id = ?',
              [machine.id]
            );
          }
          // 預約還沒到鎖定期間
          else {
            shouldLock = false;
            message = '機器可用';
            machineStatus = 'available';
          }
        } 
        // 優先級3: 使用中狀態（由硬體回報status決定）
        else if (status === 'in_use') {
          shouldLock = false;
          message = '機器使用中';
          machineStatus = 'in_use';
        }
        // 優先級4: 預設空閒狀態
        else {
          shouldLock = false;
          message = '機器可用';
          machineStatus = 'available';
        }

        // 更新機器狀態（優先使用計算出的狀態）
        const finalStatus = machineStatus;
        db.run(
          'UPDATE machines SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [finalStatus, machine.id]
        );

        responses.push({
          machine_code,
          success: true,
          should_lock: shouldLock,
          access_code: accessCode,
          message: message,
          status: finalStatus
        });
      }
    );
  });

  // 等待所有機器處理完成後返回結果
  setTimeout(() => {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      responses: responses
    });
  }, 100);
});

// 機器掃碼驗證端點（用戶掃QR Code）
router.post('/verify-access', validateMachineApiKey, (req, res) => {
  const { machine_code, access_code, user_student_id } = req.body;

  if (!machine_code || !access_code) {
    return res.status(400).json({
      success: false,
      message: '缺少必要參數'
    });
  }

  const db = getDB();

  // 驗證密碼和預約
  db.get(
    `SELECT b.*, u.student_id, u.name, m.machine_code, m.machine_type
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     JOIN machines m ON b.machine_id = m.id
     WHERE m.machine_code = ? 
       AND b.access_code = ?
       AND b.status = 'confirmed'
       AND datetime('now') BETWEEN b.start_time AND b.end_time`,
    [machine_code, access_code],
    (err, booking) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '資料庫錯誤'
        });
      }

      if (!booking) {
        return res.status(400).json({
          success: false,
          message: '密碼錯誤或預約無效'
        });
      }

      // 如果提供了學號，驗證是否匹配
      if (user_student_id && booking.student_id !== user_student_id) {
        return res.status(403).json({
          success: false,
          message: '學號不匹配'
        });
      }

      // 更新預約狀態為使用中
      db.run(
        'UPDATE bookings SET status = "in_progress" WHERE id = ?',
        [booking.id]
      );

      res.json({
        success: true,
        message: '驗證成功，可以使用機器',
        booking_info: {
          user_name: booking.name,
          student_id: booking.student_id,
          machine_type: booking.machine_type,
          end_time: booking.end_time
        }
      });
    }
  );
});

// 獲取機器當前狀態（供Arduino查詢）
router.get('/status/:machine_code', validateMachineApiKey, (req, res) => {
  const { machine_code } = req.params;
  const db = getDB();

  db.get(
    `SELECT m.*, b.id as booking_id, b.start_time, b.end_time, b.access_code,
            u.name as user_name, u.student_id
     FROM machines m
     LEFT JOIN bookings b ON m.id = b.machine_id 
       AND b.status IN ('confirmed', 'in_progress')
       AND datetime('now') BETWEEN b.start_time AND b.end_time
     LEFT JOIN users u ON b.user_id = u.id
     WHERE m.machine_code = ?`,
    [machine_code],
    (err, machine) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '資料庫錯誤'
        });
      }

      if (!machine) {
        return res.status(404).json({
          success: false,
          message: '機器不存在'
        });
      }

      const now = new Date();
      let shouldLock = true;
      let timeLeft = 0;

      if (machine.booking_id && machine.end_time) {
        const endTime = new Date(machine.end_time);
        if (now < endTime) {
          shouldLock = false;
          timeLeft = Math.max(0, Math.floor((endTime - now) / 1000 / 60)); // 分鐘
        }
      }

      res.json({
        success: true,
        machine: {
          machine_code: machine.machine_code,
          machine_type: machine.machine_type,
          location: machine.location,
          status: machine.status,
          should_lock: shouldLock,
          time_left: timeLeft,
          has_booking: !!machine.booking_id,
          user_info: machine.booking_id ? {
            name: machine.user_name,
            student_id: machine.student_id
          } : null
        }
      });
    }
  );
});

module.exports = router;
