const express = require('express');
const crypto = require('crypto');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// LINE Bot設定
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// 前端服務URL設定
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const LINE_HELP_PAGE_URL = process.env.LINE_HELP_PAGE_URL || `${CLIENT_BASE_URL}/line-binding`;
const LINE_BOOKING_PAGE_URL = process.env.LINE_BOOKING_PAGE_URL || `${CLIENT_BASE_URL}/booking`;
const LINE_MACHINES_PAGE_URL = process.env.LINE_MACHINES_PAGE_URL || `${CLIENT_BASE_URL}/machines`;

// 存儲待綁定的臨時數據 (實際應用中應使用Redis或資料庫)
const pendingBindings = new Map();

// 生成6位數字綁定密碼
function generateBindingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 驗證LINE簽名
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINE Bot Webhook
router.post('/webhook', (req, res) => {
  const signature = req.get('X-Line-Signature');
  const body = JSON.stringify(req.body);

  console.log('=== LINE Webhook 收到請求 ===');
  console.log('📅 時間:', new Date().toLocaleString('zh-TW'));
  console.log('🔐 Signature:', signature ? '✅ 有簽名' : '❌ 無簽名');
  console.log('📦 Body Length:', body.length);
  console.log('📋 Raw Body:', req.body);
  console.log('🎯 Events 數量:', req.body.events?.length || 0);

  // 暫時跳過簽名驗證（開發環境）
  // if (process.env.NODE_ENV === 'production' && !verifySignature(body, signature)) {
  //   console.error('❌ 簽名驗證失敗');
  //   return res.status(401).json({ error: 'Invalid signature' });
  // }

  const events = req.body.events || [];
  
  events.forEach((event, index) => {
    console.log(`\n=== 處理事件 ${index + 1} ===`);
    console.log('📌 事件類型:', event.type);
    console.log('👤 用戶ID:', event.source?.userId);
    
    if (event.type === 'message') {
      console.log('💬 訊息類型:', event.message?.type);
      console.log('📝 訊息內容:', event.message?.text);
    }
    
    console.log('🔍 完整事件:', JSON.stringify(event, null, 2));
    
    if (event.type === 'message' && event.message.type === 'text') {
      console.log('🚀 呼叫 handleTextMessage');
      handleTextMessage(event);
    } else if (event.type === 'follow') {
      console.log('🚀 呼叫 handleFollowEvent'); 
      handleFollowEvent(event);
    } else {
      console.log('⚠️ 未處理的事件類型:', event.type);
    }
  });

  res.status(200).json({ status: 'ok' });
});

// 處理文字訊息
async function handleTextMessage(event) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  
  console.log(`\n=== 處理文字訊息 ===`);
  console.log(`👤 用戶ID: ${userId}`);
  console.log(`💬 訊息內容: "${text}"`);
  console.log(`🔢 是否為6位數字: ${/^\d{6}$/.test(text)}`);
  
  // 檢查是否為綁定密碼 (6位數字)
  if (/^\d{6}$/.test(text)) {
    console.log('🔑 檢測到綁定密碼，呼叫處理函數');
    await handleBindingCode(userId, text, event.replyToken);
    return;
  }
  
  // 簡單的回應邏輯
  let replyText = '您好！這是校園洗衣機預約系統的LINE Bot。\n\n';
  
  if (text.includes('預約') || text.includes('洗衣')) {
    replyText += `您可以透過以下連結進行洗衣機預約：\n${LINE_BOOKING_PAGE_URL}`;
  } else if (text.includes('狀態') || text.includes('機器')) {
    replyText += `您可以查看洗衣機狀態：\n${LINE_MACHINES_PAGE_URL}`;
  } else if (text.includes('綁定') || text.includes('註冊')) {
    replyText += `請前往系統生成綁定密碼，然後在這裡輸入6位數字密碼即可完成綁定。\n\n系統網址：\n${LINE_HELP_PAGE_URL}`;
  } else if (text.includes('幫助') || text.includes('說明')) {
    replyText += '🔗 帳號綁定：前往系統生成密碼後輸入\n📱 洗衣預約：預約 或 洗衣\n🔍 機器狀態：狀態 或 機器\n❓ 使用說明：幫助 或 說明';
  } else {
    replyText += '請輸入以下指令：\n• 6位數字 - 綁定帳號\n• 預約/洗衣 - 查看預約功能\n• 狀態/機器 - 查看機器狀態\n• 綁定 - 取得綁定說明\n• 幫助 - 顯示所有功能';
  }
  
  // 如果有access token，發送回應
  if (LINE_CHANNEL_ACCESS_TOKEN) {
    await sendReplyMessage(event.replyToken, replyText);
  }
}

// 處理綁定密碼
async function handleBindingCode(userId, code, replyToken) {
  console.log(`\n=== 處理綁定密碼 ===`);
  console.log(`🔑 綁定密碼: ${code}`);
  console.log(`👤 LINE用戶ID: ${userId}`);
  console.log(`📋 當前待綁定列表:`, [...pendingBindings.keys()]);
  
  // 檢查綁定密碼是否存在且未過期
  const bindingData = pendingBindings.get(code);
  
  if (!bindingData) {
    console.log('❌ 綁定密碼不存在');
    await sendReplyMessage(replyToken, '❌ 綁定密碼無效或已過期，請重新生成密碼。');
    return;
  }
  
  console.log(`📊 綁定資料:`, bindingData);
  console.log(`⏰ 當前時間: ${Date.now()}, 過期時間: ${bindingData.expires}`);
  
  if (Date.now() > bindingData.expires) {
    console.log('❌ 綁定密碼已過期');
    pendingBindings.delete(code);
    await sendReplyMessage(replyToken, '❌ 綁定密碼已過期，請重新生成密碼。');
    return;
  }
  
  console.log('✅ 綁定密碼驗證成功，開始綁定...');
  
  // 執行綁定
  const db = getDB();
  
  db.run(
    'UPDATE users SET line_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [userId, bindingData.userId],
    async function(err) {
      if (err) {
        console.error('❌ 綁定LINE帳號資料庫錯誤:', err);
        await sendReplyMessage(replyToken, '❌ 綁定失敗，請稍後再試。');
        return;
      }
      
      console.log(`✅ 資料庫更新成功，影響行數: ${this.changes}`);
      
      // 清除已使用的綁定密碼
      pendingBindings.delete(code);
      console.log(`🗑️ 已清除綁定密碼: ${code}`);
      
      console.log(`🎉 用戶 ${bindingData.userId} 成功綁定LINE帳號: ${userId}`);
      
      await sendReplyMessage(replyToken, 
        `✅ 綁定成功！\n\n您的帳號已成功綁定到校園洗衣機預約系統。\n\n現在您可以：\n• 接收洗衣完成通知\n• 透過LINE查詢預約狀態\n• 使用語音指令進行預約\n\n感謝您的使用！🎉`
      );
    }
  );
}

// 處理關注事件
async function handleFollowEvent(event) {
  const userId = event.source.userId;
  console.log(`新用戶關注: ${userId}`);
  
  const welcomeText = `🎉 歡迎使用校園洗衣機預約系統！

  👋 感謝您加入我們的服務

  🔗 如需綁定帳號：
  1. 前往系統網站生成綁定密碼
  2. 在此輸入6位數字密碼即可完成綁定

  💡 系統網址：
  ${LINE_HELP_PAGE_URL}

  📋 可用指令：
• 6位數字 - 綁定帳號
• 預約/洗衣 - 查看預約功能  
• 狀態/機器 - 查看機器狀態
• 幫助 - 顯示所有功能

現在就開始體驗吧！`;

  if (LINE_CHANNEL_ACCESS_TOKEN && LINE_CHANNEL_ACCESS_TOKEN !== 'your-line-channel-access-token') {
    await sendReplyMessage(event.replyToken, welcomeText);
  }
}

// 發送回應訊息
async function sendReplyMessage(replyToken, text) {
  try {
    const axios = require('axios');
    
    await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: text
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'WashingMachine-LineBot/1.0'
      }
    });
    
    console.log('回應訊息發送成功');
  } catch (error) {
    console.error('發送回應訊息失敗:', error.response?.data || error.message);
  }
}

// 生成綁定密碼
router.post('/generate-binding-code', authMiddleware, (req, res) => {
  const userId = req.user.id;
  
  // 檢查用戶是否已經綁定
  const db = getDB();
  
  db.get(
    'SELECT line_user_id FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        console.error('資料庫查詢錯誤:', err);
        return res.status(500).json({ message: '資料庫錯誤' });
      }
      
      if (user && user.line_user_id) {
        return res.status(400).json({ 
          message: '您已經綁定LINE帳號',
          line_user_id: user.line_user_id
        });
      }
      
      // 生成新的綁定密碼
      const bindingCode = generateBindingCode();
      const expires = Date.now() + 10 * 60 * 1000; // 10分鐘後過期
      
      // 儲存綁定信息
      pendingBindings.set(bindingCode, {
        userId: userId,
        userName: req.user.name,
        studentId: req.user.student_id,
        expires: expires,
        created: Date.now()
      });
      
      console.log(`為用戶 ${userId} (${req.user.name}) 生成綁定密碼: ${bindingCode}`);
      
      res.json({
        binding_code: bindingCode,
        expires_in: 600, // 10分鐘
        expires_at: new Date(expires).toISOString(),
        instructions: {
          step1: '加入LINE Bot好友',
          step2: '在LINE中輸入此6位數字密碼',
          step3: '等待系統確認綁定完成'
        },
  qr_data: `綁定密碼: ${bindingCode}`, // 可用於生成QR code
  line_bot_id: process.env.LINE_BOT_BASIC_ID || ''
      });
    }
  );
});

// 查詢綁定狀態
router.get('/binding-status/:code', authMiddleware, (req, res) => {
  const { code } = req.params;
  const bindingData = pendingBindings.get(code);
  
  if (!bindingData) {
    return res.json({ 
      status: 'not_found',
      message: '綁定密碼不存在或已過期'
    });
  }
  
  if (Date.now() > bindingData.expires) {
    pendingBindings.delete(code);
    return res.json({ 
      status: 'expired',
      message: '綁定密碼已過期'
    });
  }
  
  // 檢查是否已完成綁定
  const db = getDB();
  
  db.get(
    'SELECT line_user_id FROM users WHERE id = ?',
    [bindingData.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: '資料庫錯誤' });
      }
      
      if (user && user.line_user_id) {
        pendingBindings.delete(code);
        return res.json({ 
          status: 'completed',
          message: '綁定已完成',
          line_user_id: user.line_user_id
        });
      }
      
      res.json({ 
        status: 'pending',
        message: '等待用戶在LINE中輸入密碼',
        expires_in: Math.max(0, Math.floor((bindingData.expires - Date.now()) / 1000))
      });
    }
  );
});

// 清理過期的綁定密碼
router.post('/cleanup-expired-codes', authMiddleware, (req, res) => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [code, data] of pendingBindings.entries()) {
    if (now > data.expires) {
      pendingBindings.delete(code);
      cleanedCount++;
    }
  }
  
  res.json({ 
    message: `清理了 ${cleanedCount} 個過期綁定密碼`,
    remaining: pendingBindings.size
  });
});

// 測試LINE Bot配置
router.get('/test-config', authMiddleware, (req, res) => {
  const port = process.env.PORT || '3000';
  const protocol = process.env.SERVER_PROTOCOL || 'http';
  const serverHost = process.env.SERVER_HOST || `localhost`;
  const bindingBaseUrl = process.env.BINDING_BASE_URL || CLIENT_BASE_URL;
  const tunnelUrl = process.env.TUNNEL_URL || process.env.NGROK_URL || '';
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || (process.env.PUBLIC_HOST ? `${protocol}://${process.env.PUBLIC_HOST}:${port}` : '');
  const webhookBase = tunnelUrl || publicBaseUrl || `${protocol}://${serverHost}:${port}`;

  res.json({
    channel_id: LINE_CHANNEL_ID || '未設定',
    channel_secret: LINE_CHANNEL_SECRET ? '已設定' : '未設定',
    access_token: LINE_CHANNEL_ACCESS_TOKEN ? '已設定' : '未設定',
    webhook_url: `${webhookBase}/api/line/webhook`,
    local_webhook_url: `${protocol}://${serverHost}:${port}/api/line/webhook`,
    binding_url: `${bindingBaseUrl}/line-bind`,
    line_bot_id: process.env.LINE_BOT_BASIC_ID || '',
    tunnel_url: tunnelUrl || '未設定',
    tunnel_status: tunnelUrl ? '✅ HTTPS已啟用' : 'ℹ️ 尚未建立隧道'
  });
});

// 用戶綁定LINE帳號 (僅用於解除綁定)
router.post('/bind', authMiddleware, (req, res) => {
  const { line_user_id } = req.body;
  
  // 僅允許null值來解除綁定
  if (line_user_id !== null) {
    return res.status(400).json({ 
      message: '請使用新的自動綁定系統',
      debug: '手動綁定已停用，請使用綁定密碼功能'
    });
  }
  
  const db = getDB();
  
  db.run(
    'UPDATE users SET line_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [null, req.user.id],
    function(err) {
      if (err) {
        console.error('解除綁定LINE帳號資料庫錯誤:', err);
        return res.status(500).json({ message: '解除綁定LINE帳號失敗' });
      }
      
      console.log(`用戶 ${req.user.id} 解除綁定LINE帳號`);
      
      res.json({ 
        message: 'LINE帳號解除綁定成功',
        line_user_id: null
      });
    }
  );
});

// 發送測試通知
router.post('/test-notification', authMiddleware, async (req, res) => {
  const { message } = req.body;
  const db = getDB();
  
  console.log('測試通知請求 - 用戶ID:', req.user.id);
  
  db.get(
    'SELECT line_user_id FROM users WHERE id = ?',
    [req.user.id],
    async (err, user) => {
      if (err) {
        console.error('資料庫查詢錯誤:', err);
        return res.status(500).json({ message: '資料庫錯誤' });
      }
      
      console.log('查詢到的用戶:', user);
      
      if (!user || !user.line_user_id) {
        return res.status(400).json({ 
          message: '您尚未綁定LINE帳號',
          debug: '請先綁定LINE帳號才能發送測試通知'
        });
      }
      
      if (!LINE_CHANNEL_ACCESS_TOKEN || LINE_CHANNEL_ACCESS_TOKEN === 'your-line-channel-access-token') {
        return res.status(400).json({ message: 'LINE Bot尚未正確設定' });
      }
      
      // 驗證LINE User ID格式
      const lineUserId = user.line_user_id.trim();
      console.log('LINE User ID:', lineUserId, '長度:', lineUserId.length);
      
      if (!lineUserId.startsWith('U') || lineUserId.length !== 33) {
        return res.status(400).json({ 
          message: 'LINE User ID格式不正確',
          debug: `當前綁定的ID: ${lineUserId} (長度: ${lineUserId.length})`
        });
      }
      
      try {
        const axios = require('axios');
        
        const payload = {
          to: lineUserId,
          messages: [{
            type: 'text',
            text: message || '🎉 這是一個測試通知訊息！\n\n來自校園洗衣機預約系統'
          }]
        };
        
        console.log('發送LINE通知請求:', JSON.stringify(payload, null, 2));
        
        const response = await axios.post('https://api.line.me/v2/bot/message/push', payload, {
          headers: {
            'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'WashingMachine-LineBot/1.0'
          }
        });
        
        console.log('LINE API回應:', response.status);
        res.json({ message: '測試通知發送成功' });
      } catch (error) {
        console.error('發送測試通知失敗:', error.response?.data || error.message);
        res.status(500).json({ 
          message: '發送測試通知失敗',
          error: error.response?.data || error.message,
          debug: error.response?.status ? `HTTP ${error.response.status}` : '網路錯誤'
        });
      }
    }
  );
});

// 測試直接綁定端點（僅開發環境）
router.post('/test-bind', authMiddleware, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: '生產環境不允許測試綁定' });
  }
  
  const testUserId = 'U76c0f169ff746b1afe076870657c0cbc'; // 你的LINE User ID
  
  const db = getDB();
  
  db.run(
    'UPDATE users SET line_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [testUserId, req.user.id],
    function(err) {
      if (err) {
        console.error('測試綁定失敗:', err);
        return res.status(500).json({ message: '測試綁定失敗' });
      }
      
      console.log(`✅ 測試綁定成功: 用戶 ${req.user.id} -> LINE ID ${testUserId}`);
      
      res.json({ 
        message: '測試綁定成功',
        line_user_id: testUserId,
        user_id: req.user.id
      });
    }
  );
});

// ngrok webhook驗證端點
router.get('/webhook', (req, res) => {
  console.log('收到LINE webhook驗證請求');
  res.status(200).send('OK');
});

// 調試端點 - 檢查所有請求
router.all('/webhook-debug', (req, res) => {
  console.log('\n=== WEBHOOK 調試信息 ===');
  console.log('方法:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Query:', req.query);
  console.log('========================\n');
  
  res.status(200).json({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
