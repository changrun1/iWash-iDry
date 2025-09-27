const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authMiddleware = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '未提供認證令牌' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 從資料庫獲取用戶信息
    const db = getDB();
    db.get(
      'SELECT * FROM users WHERE id = ?',
      [decoded.userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ message: '資料庫錯誤' });
        }
        
        if (!user) {
          return res.status(401).json({ message: '用戶不存在' });
        }
        
        req.user = user;
        next();
      }
    );
  } catch (error) {
    res.status(401).json({ message: '無效的認證令牌' });
  }
};

module.exports = { authMiddleware, JWT_SECRET };
