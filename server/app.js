require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');
const machineRoutes = require('./routes/machine');
const paymentRoutes = require('./routes/payment');
const lineBotRoutes = require('./routes/line-bot');
const lineRoutes = require('./routes/line');
const machineControlRoutes = require('./routes/machine-control');
const hardwareRoutes = require('./routes/hardware');
const notificationRoutes = require('./routes/notification');
const publicRoutes = require('./routes/public');

const { initDatabase } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { startScheduledTasks } = require('./services/scheduledTasks');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOriginPatterns = (process.env.ALLOWED_ORIGIN_PATTERNS || 'https://*.loca.lt')
  .split(',')
  .map(pattern => pattern.trim())
  .filter(Boolean);

const isOriginAllowed = origin => {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return allowedOriginPatterns.some(pattern => {
    if (!pattern) return false;
    const regex = new RegExp('^' + pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return regex.test(origin);
  });
};

// 設定 trust proxy 來支持代理（ngrok等）
app.set('trust proxy', 1);

// 安全性中間件
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

// 限制請求頻率
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 100 // 限制每個IP 15分鐘內最多100個請求
});
app.use(limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 提供靜態文件服務
app.use(express.static(path.join(__dirname, 'public')));

// 初始化資料庫
initDatabase();

// 啟動定時任務
startScheduledTasks();

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/machine', machineRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/line-bot', lineBotRoutes);
app.use('/api/line', lineRoutes);
app.use('/api/machine-control', machineControlRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/public', publicRoutes);

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 錯誤處理中間件
app.use(errorHandler);

// 404處理
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API路由不存在' });
});

app.listen(PORT, '0.0.0.0', () => {
  const protocol = process.env.SERVER_PROTOCOL || 'http';
  const serverHost = process.env.SERVER_HOST || 'localhost';
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || (process.env.PUBLIC_HOST ? `${protocol}://${process.env.PUBLIC_HOST}:${PORT}` : '');
  const tunnelUrl = process.env.TUNNEL_URL;

  console.log('🚀 洗衣機預約系統後端服務器啟動成功');
  console.log(`   ✅ 本地開發: http://localhost:${PORT}`);
  console.log(`   ✅ 服務器: ${protocol}://${serverHost}:${PORT}`);
  if (publicBaseUrl) {
    console.log(`   ✅ 公開網址: ${publicBaseUrl}`);
  }
  if (tunnelUrl) {
    console.log(`   🔒 HTTPS 隧道: ${tunnelUrl}`);
    console.log(`   � HTTPS Webhook: ${tunnelUrl}/api/line/webhook`);
  }
  console.log(`📱 健康檢查: ${protocol}://${serverHost}:${PORT}/api/health`);
  if (publicBaseUrl) {
    console.log(`🌐 HTTP Webhook: ${publicBaseUrl}/api/line/webhook`);
  }
  console.log(`🤖 LINE Bot Basic ID: ${process.env.LINE_BOT_BASIC_ID || '未設定'}`);
});
