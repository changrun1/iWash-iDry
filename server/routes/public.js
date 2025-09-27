const express = require('express');
const { getDB } = require('../config/database');

const router = express.Router();

// 獲取所有機器狀態（公開API，供硬體設備調用）
router.get('/status', (req, res) => {
  const db = getDB();

  db.all(
    `SELECT 
      m.machine_code,
      m.machine_type,
      m.location,
      m.region,
      m.status,
      m.is_online,
      m.last_ping,
      b.id as booking_id,
      b.start_time,
      b.end_time,
      b.access_code,
      u.name as user_name,
      u.student_id
    FROM machines m
    LEFT JOIN bookings b ON m.id = b.machine_id 
      AND b.status IN ('confirmed', 'in_progress')
      AND datetime('now') BETWEEN b.start_time AND b.end_time
    LEFT JOIN users u ON b.user_id = u.id
    ORDER BY m.machine_code`,
    [],
    (err, machines) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '資料庫錯誤'
        });
      }

      // 計算每台機器的詳細狀態
      const machineStatus = machines.map(machine => {
        const now = new Date();
        let shouldLock = true;
        let timeLeft = 0;
        let nextBooking = null;

        if (machine.booking_id && machine.end_time) {
          const endTime = new Date(machine.end_time);
          if (now < endTime) {
            shouldLock = false;
            timeLeft = Math.max(0, Math.floor((endTime - now) / 1000 / 60)); // 分鐘
          }
        }

        // 查找下一個預約
        // 這裡可以添加查詢下一個預約的邏輯

        return {
          machine_code: machine.machine_code,
          machine_type: machine.machine_type,
          location: machine.location,
          region: machine.region,
          status: machine.status,
          is_online: machine.is_online,
          last_ping: machine.last_ping,
          should_lock: shouldLock,
          time_left: timeLeft,
          has_current_booking: !!machine.booking_id,
          current_user: machine.booking_id ? {
            name: machine.user_name,
            student_id: machine.student_id
          } : null,
          access_code: machine.access_code,
          next_booking: nextBooking
        };
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        total_machines: machines.length,
        available_count: machineStatus.filter(m => m.status === 'available' && !m.has_current_booking).length,
        in_use_count: machineStatus.filter(m => m.has_current_booking).length,
        offline_count: machineStatus.filter(m => !m.is_online).length,
        machines: machineStatus
      });
    }
  );
});

// 更新機器在線狀態（供硬體控制器調用）
router.post('/ping', (req, res) => {
  const { machine_codes } = req.body;

  if (!Array.isArray(machine_codes)) {
    return res.status(400).json({
      success: false,
      message: 'machine_codes必須是陣列格式'
    });
  }

  const db = getDB();
  const now = new Date().toISOString();

  // 更新指定機器的在線狀態
  const updatePromises = machine_codes.map(machine_code => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE machines SET is_online = 1, last_ping = ? WHERE machine_code = ?',
        [now, machine_code],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ machine_code, updated: this.changes > 0 });
          }
        }
      );
    });
  });

  Promise.all(updatePromises)
    .then(results => {
      // 將5分鐘沒有ping的機器標記為離線
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      db.run(
        'UPDATE machines SET is_online = 0 WHERE last_ping < ?',
        [fiveMinutesAgo]
      );

      res.json({
        success: true,
        timestamp: now,
        updated_machines: results
      });
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        message: '更新機器狀態失敗',
        error: error.message
      });
    });
});

// 獲取機器統計信息
router.get('/statistics', (req, res) => {
  const db = getDB();

  db.all(
    `SELECT 
      COUNT(*) as total_machines,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_machines,
      SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) as in_use_machines,
      SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_machines,
      SUM(CASE WHEN machine_type = 'washer' THEN 1 ELSE 0 END) as washing_machines,
      SUM(CASE WHEN machine_type = 'dryer' THEN 1 ELSE 0 END) as drying_machines,
      SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_machines
    FROM machines`,
    [],
    (err, stats) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '獲取統計信息失敗'
        });
      }

      const statistics = stats[0] || {};

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        statistics: {
          total_machines: statistics.total_machines || 0,
          available_machines: statistics.available_machines || 0,
          in_use_machines: statistics.in_use_machines || 0,
          maintenance_machines: statistics.maintenance_machines || 0,
          washing_machines: statistics.washing_machines || 0,
          drying_machines: statistics.drying_machines || 0,
          online_machines: statistics.online_machines || 0,
          offline_machines: (statistics.total_machines || 0) - (statistics.online_machines || 0)
        }
      });
    }
  );
});

module.exports = router;
