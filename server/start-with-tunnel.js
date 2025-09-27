const { spawn } = require('child_process');
const localtunnel = require('localtunnel');
const path = require('path');

// 設定工作目錄為當前腳本所在目錄
process.chdir(__dirname);

const PORT = process.env.PORT || 3000;
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN;

// 啟動 Express 服務器
console.log('🚀 啟動洗衣機預約系統服務器...');
const server = spawn('node', ['app.js'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

// 等待服務器啟動
setTimeout(async () => {
  try {
    console.log('🌐 正在建立 localtunnel 連接...');
    
    // 建立 tunnel
    const tunnelOptions = { port: PORT };
    if (SUBDOMAIN) {
      tunnelOptions.subdomain = SUBDOMAIN;
    }

    const tunnel = await localtunnel(tunnelOptions);

    const tunnelUrl = tunnel.url;
    console.log('\n🎉 Localtunnel 設置成功!');
    console.log(`📱 公開 HTTPS URL: ${tunnelUrl}`);
    console.log(`📱 LINE Webhook URL: ${tunnelUrl}/api/line/webhook`);
    console.log(`🔗 健康檢查: ${tunnelUrl}/api/health`);
    console.log('\n請將這個 webhook URL 設置到你的 LINE Bot 設定中。');

    // 監聽 tunnel 關閉事件
    tunnel.on('close', () => {
      console.log('\n❌ Localtunnel 連接已關閉');
    });

    tunnel.on('error', (err) => {
      console.error('❌ Localtunnel 錯誤:', err.message);
    });

  } catch (error) {
    console.error('❌ 建立 localtunnel 失敗:', error.message);
    console.log('💡 嘗試使用隨機子域名...');
    
    try {
      const tunnel = await localtunnel({ port: PORT });
      const tunnelUrl = tunnel.url;
      console.log('\n🎉 Localtunnel 設置成功 (隨機域名)!');
      console.log(`📱 公開 HTTPS URL: ${tunnelUrl}`);
      console.log(`📱 LINE Webhook URL: ${tunnelUrl}/api/line/webhook`);
      console.log(`🔗 健康檢查: ${tunnelUrl}/api/health`);
    } catch (fallbackError) {
      console.error('❌ 建立 localtunnel 完全失敗:', fallbackError.message);
    }
  }
}, 3000);

// 處理程式關閉
process.on('SIGINT', () => {
  console.log('\n🛑 正在關閉服務...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在關閉服務...');
  server.kill();
  process.exit(0);
});
