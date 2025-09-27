const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // 預設錯誤響應
  let error = { ...err };
  error.message = err.message;

  // 資料庫錯誤
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    error.message = '資料已存在';
    error.statusCode = 400;
  }

  // JWT錯誤
  if (err.name === 'JsonWebTokenError') {
    error.message = '無效的認證令牌';
    error.statusCode = 401;
  }

  // JWT過期錯誤
  if (err.name === 'TokenExpiredError') {
    error.message = '認證令牌已過期';
    error.statusCode = 401;
  }

  // 驗證錯誤
  if (err.name === 'ValidationError') {
    error.message = '資料驗證失敗';
    error.statusCode = 400;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || '伺服器內部錯誤',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };
