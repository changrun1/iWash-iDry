const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 註冊/登入 (使用學號)
router.post('/login', [
  body('student_id').isLength({ min: 5 }).withMessage('學號至少5位數'),
  body('name').optional().isLength({ min: 2 }).withMessage('姓名至少2個字'),
  body('dorm_number').optional().isLength({ min: 1 }).withMessage('請輸入宿舍號碼'),
  body('bed_number').optional().isLength({ min: 1 }).withMessage('請輸入床位號碼')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入資料有誤', 
        errors: errors.array() 
      });
    }

    const { student_id, name, dorm_number, bed_number } = req.body;
    const db = getDB();

    // 檢查用戶是否存在
    db.get(
      'SELECT * FROM users WHERE student_id = ?',
      [student_id],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ message: '資料庫錯誤' });
        }

        if (user) {
          // 用戶存在，直接登入
          const token = jwt.sign(
            { userId: user.id, studentId: user.student_id },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({
            message: '登入成功',
            token,
            user: {
              id: user.id,
              student_id: user.student_id,
              name: user.name,
              dorm_number: user.dorm_number,
              bed_number: user.bed_number
            }
          });
        } else {
          // 用戶不存在，創建新用戶
          if (!name || !dorm_number || !bed_number) {
            return res.status(400).json({ 
              message: '首次登入需要提供姓名、宿舍號碼和床位號碼' 
            });
          }

          db.run(
            'INSERT INTO users (student_id, name, dorm_number, bed_number) VALUES (?, ?, ?, ?)',
            [student_id, name, dorm_number, bed_number],
            function(err) {
              if (err) {
                return res.status(500).json({ message: '註冊失敗' });
              }

              const token = jwt.sign(
                { userId: this.lastID, studentId: student_id },
                JWT_SECRET,
                { expiresIn: '7d' }
              );

              res.status(201).json({
                message: '註冊成功',
                token,
                user: {
                  id: this.lastID,
                  student_id,
                  name,
                  dorm_number,
                  bed_number
                }
              });
            }
          );
        }
      }
    );
  } catch (error) {
    res.status(500).json({ message: '登入失敗', error: error.message });
  }
});

// 檢查用戶是否存在
router.get('/check-user/:student_id', (req, res) => {
  const { student_id } = req.params;
  const db = getDB();

  db.get(
    'SELECT id FROM users WHERE student_id = ?',
    [student_id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: '資料庫錯誤' });
      }

      res.json({
        exists: !!user,
        student_id
      });
    }
  );
});

// 獲取用戶信息 (profile 別名)
router.get('/profile', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      student_id: req.user.student_id,
      name: req.user.name,
      dorm_number: req.user.dorm_number,
      bed_number: req.user.bed_number,
      line_user_id: req.user.line_user_id
    }
  });
});

// 獲取用戶信息 (me 別名)
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      student_id: req.user.student_id,
      name: req.user.name,
      dorm_number: req.user.dorm_number,
      bed_number: req.user.bed_number,
      line_user_id: req.user.line_user_id
    }
  });
});

// 獲取用戶統計資料
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDB();
  
  // 獲取用戶預約統計
  db.all(
    `SELECT 
      COUNT(*) as total_bookings,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
      SUM(payment_amount) as total_spent
    FROM bookings 
    WHERE user_id = ?`,
    [req.user.id],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ message: '獲取統計資料失敗' });
      }
      
      const userStats = stats[0] || {
        total_bookings: 0,
        completed_bookings: 0,
        cancelled_bookings: 0,
        total_spent: 0
      };
      
      res.json({
        stats: {
          totalBookings: userStats.total_bookings,
          completedBookings: userStats.completed_bookings,
          cancelledBookings: userStats.cancelled_bookings,
          totalSpent: userStats.total_spent || 0,
          memberSince: req.user.created_at
        }
      });
    }
  );
});

// 更新用戶信息
router.put('/profile', authMiddleware, [
  body('name').optional().isLength({ min: 2 }).withMessage('姓名至少2個字'),
  body('dorm_number').optional().isLength({ min: 1 }).withMessage('請輸入有效的宿舍號碼'),
  body('bed_number').optional().isLength({ min: 1 }).withMessage('請輸入有效的床位號碼')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入資料有誤', 
        errors: errors.array() 
      });
    }

    const { name, dorm_number, bed_number, line_user_id } = req.body;
    const db = getDB();

    db.run(
      'UPDATE users SET name = COALESCE(?, name), dorm_number = COALESCE(?, dorm_number), bed_number = COALESCE(?, bed_number), line_user_id = COALESCE(?, line_user_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, dorm_number, bed_number, line_user_id, req.user.id],
      function(err) {
        if (err) {
          return res.status(500).json({ message: '更新失敗' });
        }

        res.json({ message: '個人資料更新成功' });
      }
    );
  } catch (error) {
    res.status(500).json({ message: '更新失敗', error: error.message });
  }
});

// 驗證令牌
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ 
    message: '令牌有效',
    user: {
      id: req.user.id,
      student_id: req.user.student_id,
      name: req.user.name
    }
  });
});

module.exports = router;
