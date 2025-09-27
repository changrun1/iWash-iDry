const express = require('express');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 獲取所有洗衣機狀態
router.get('/status', authMiddleware, (req, res) => {
  const db = getDB();
  const { location, machine_type, region } = req.query;

  let query = `
    SELECT 
      m.*,
      u.name as current_user_name,
      u.student_id as current_user_student_id
    FROM machines m
    LEFT JOIN users u ON m.current_user_id = u.id
    WHERE m.is_online = 1 
    AND datetime(m.last_ping) > datetime('now', '-30 seconds')
  `;

  const params = [];
  const conditions = [];

  if (location) {
    conditions.push('m.location = ?');
    params.push(location);
  }

  if (machine_type) {
    conditions.push('m.machine_type = ?');
    params.push(machine_type);
  }

  if (region) {
    conditions.push('m.region = ?');
    params.push(region);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  query += ' ORDER BY m.region, m.machine_code';

  db.all(query, params, (err, machines) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: '獲取洗衣機狀態失敗' });
    }

    // 計算剩餘時間
    const machinesWithTimeLeft = machines.map(machine => {
      let timeLeft = null;
      if (machine.status === 'in_use' && machine.end_time) {
        const endTime = new Date(machine.end_time);
        const now = new Date();
        const diff = endTime.getTime() - now.getTime();
        timeLeft = Math.max(0, Math.ceil(diff / (1000 * 60))); // 分鐘
      }

      return {
        ...machine,
        time_left_minutes: timeLeft
      };
    });

    // 按區域分組
    const regions = {};
    machinesWithTimeLeft.forEach(machine => {
      if (!regions[machine.region]) {
        regions[machine.region] = {
          region: machine.region,
          machines: []
        };
      }
      regions[machine.region].machines.push(machine);
    });

    res.json({ 
      machines: machinesWithTimeLeft,
      regions: Object.values(regions),
      total: machinesWithTimeLeft.length,
      online_regions: Object.keys(regions).length
    });
  });
});

// 獲取特定洗衣機詳細信息
router.get('/:machineId', authMiddleware, (req, res) => {
  const { machineId } = req.params;
  const db = getDB();

  db.get(
    `SELECT 
      m.*,
      u.name as current_user_name,
      u.student_id as current_user_student_id
    FROM machines m
    LEFT JOIN users u ON m.current_user_id = u.id
    WHERE m.id = ?`,
    [machineId],
    (err, machine) => {
      if (err) {
        return res.status(500).json({ message: '獲取洗衣機信息失敗' });
      }

      if (!machine) {
        return res.status(404).json({ message: '洗衣機不存在' });
      }

      // 計算剩餘時間
      let timeLeft = null;
      if (machine.status === 'in_use' && machine.end_time) {
        const endTime = new Date(machine.end_time);
        const now = new Date();
        const diff = endTime.getTime() - now.getTime();
        timeLeft = Math.max(0, Math.ceil(diff / (1000 * 60))); // 分鐘
      }

      res.json({
        machine: {
          ...machine,
          time_left_minutes: timeLeft
        }
      });
    }
  );
});

// 獲取洗衣機今日預約
router.get('/:machineId/today-bookings', authMiddleware, (req, res) => {
  const { machineId } = req.params;
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];

  db.all(
    `SELECT 
      b.*,
      u.name as user_name,
      u.student_id
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.machine_id = ? 
    AND DATE(b.start_time) = ?
    AND b.status IN ('confirmed', 'in_progress', 'completed')
    ORDER BY b.start_time`,
    [machineId, today],
    (err, bookings) => {
      if (err) {
        return res.status(500).json({ message: '獲取預約記錄失敗' });
      }

      res.json({ bookings });
    }
  );
});

// API接口：更新洗衣機狀態（供外部系統調用）
router.post('/update-status', (req, res) => {
  const { api_key, machines } = req.body;

  // 簡單的API密鑰驗證
  if (api_key !== process.env.MACHINE_API_KEY && api_key !== 'demo-api-key-change-in-production') {
    return res.status(401).json({ message: '無效的API密鑰' });
  }

  if (!Array.isArray(machines)) {
    return res.status(400).json({ message: 'machines必須是陣列' });
  }

  const db = getDB();
  const updates = [];

  machines.forEach(machineData => {
    const { machine_code, status, current_user_id, start_time, end_time } = machineData;

    if (!machine_code || !status) {
      return;
    }

    updates.push(
      new Promise((resolve, reject) => {
        db.run(
          `UPDATE machines 
           SET status = ?, current_user_id = ?, start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE machine_code = ?`,
          [status, current_user_id || null, start_time || null, end_time || null, machine_code],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ machine_code, updated: this.changes > 0 });
            }
          }
        );
      })
    );
  });

  Promise.all(updates)
    .then(results => {
      res.json({
        message: '洗衣機狀態更新完成',
        results
      });
    })
    .catch(err => {
      res.status(500).json({ message: '更新失敗', error: err.message });
    });
});

// 獲取所有位置
router.get('/locations/list', authMiddleware, (req, res) => {
  const db = getDB();

  db.all(
    'SELECT DISTINCT location FROM machines ORDER BY location',
    [],
    (err, locations) => {
      if (err) {
        return res.status(500).json({ message: '獲取位置列表失敗' });
      }

      res.json({ 
        locations: locations.map(row => row.location) 
      });
    }
  );
});

// 開始使用洗衣機（掃碼功能）
router.post('/:machineId/start', authMiddleware, (req, res) => {
  const { machineId } = req.params;
  const db = getDB();

  // 檢查用戶是否有該洗衣機的有效預約
  const now = new Date();
  
  db.get(
    `SELECT * FROM bookings 
     WHERE machine_id = ? 
     AND user_id = ? 
     AND status = 'confirmed' 
     AND start_time <= ? 
     AND end_time > ?`,
    [machineId, req.user.id, now.toISOString(), now.toISOString()],
    (err, booking) => {
      if (err) {
        return res.status(500).json({ message: '檢查預約失敗' });
      }

      if (!booking) {
        return res.status(400).json({ message: '沒有有效的預約或不在使用時間內' });
      }

      // 更新洗衣機狀態為使用中
      db.run(
        `UPDATE machines 
         SET status = 'in_use', current_user_id = ?, start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [req.user.id, booking.start_time, booking.end_time, machineId],
        function(err) {
          if (err) {
            return res.status(500).json({ message: '更新洗衣機狀態失敗' });
          }

          // 更新預約狀態為進行中
          db.run(
            'UPDATE bookings SET status = "in_progress", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [booking.id],
            (err) => {
              if (err) {
                return res.status(500).json({ message: '更新預約狀態失敗' });
              }

              res.json({ 
                message: '開始使用洗衣機',
                booking_id: booking.id,
                end_time: booking.end_time
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
