<template>
  <div class="line-binding-page">
    <div class="content-container">
      <!-- LINE 帳號管理 -->
      <el-card class="account-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>LINE 帳號管理</span>
            <el-button type="primary" @click="getUserInfo" :loading="loading">
              重新檢查
            </el-button>
          </div>
        </template>
        
        <div v-if="userInfo?.line_user_id" class="account-bound">
          <el-alert
            title="已綁定LINE帳號"
            description="您的LINE已成功綁定，可以接收洗衣完成通知"
            type="success"
            :closable="false"
            show-icon
          />
          <div class="action-buttons">
            <el-button type="warning" @click="unbindLineAccount" :loading="binding">
              解除綁定
            </el-button>

          </div>
        </div>
        
        <div v-else class="account-unbound">
          <el-alert
            title="尚未綁定LINE帳號"
            description="請綁定LINE帳號以接收洗衣完成通知"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 20px;"
          />
          
          <div v-if="!bindingCode" class="bind-init">
            <el-alert
              title="安全綁定方式"
              description="系統將生成一個6位數字密碼和兩個QR碼：「加好友QR碼」和「自動傳送密碼QR碼」，讓您輕鬆完成綁定"
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 16px;"
            />
            
            <div class="action-buttons">
              <el-button type="primary" @click="generateBindingCode" :loading="generating">
                <el-icon><Key /></el-icon>
                生成綁定密碼
              </el-button>
            </div>
          </div>

          <div v-else class="bind-process">
            <el-card class="binding-card" shadow="never">
              <template #header>
                <div class="card-header">
                  <span>綁定密碼已生成</span>
                  <el-tag :type="bindingStatus === 'completed' ? 'success' : 'warning'">
                    {{ getStatusText() }}
                  </el-tag>
                </div>
              </template>
              
              <div class="binding-content">
                <div class="binding-code-section">
                  <div class="binding-code-display">
                    <div class="code-label">您的綁定密碼</div>
                    <div class="binding-code">{{ bindingCode }}</div>
                    <div class="code-hint">請在LINE Bot中輸入此密碼</div>
                  </div>
                  
                  <div class="qr-code-section">
                    <div class="qr-code-container">
                      <canvas ref="bindingQrCanvas" class="qr-canvas"></canvas>
                      <div class="qr-label">掃描自動傳送密碼</div>
                    </div>
                  </div>
                </div>
                
                <el-divider />
                
                <div class="line-bot-section">
                  <div class="line-bot-info">
                    <el-text tag="b">LINE Bot ID: </el-text>
                    <el-text class="line-bot-id">{{ lineBotIdLabel }}</el-text>
                    <el-button type="text" size="small" @click="copyLineBotId">
                      複製
                    </el-button>
                  </div>
                  
                  <div class="qr-code-container">
                    <canvas ref="lineBotQrCanvas" class="qr-canvas"></canvas>
                    <div class="qr-label">掃描加入好友</div>
                  </div>
                </div>
                
                <el-divider />
                
                <div class="binding-steps">
                  <el-steps :active="currentBindingStep" finish-status="success" align-center>
                    <el-step title="生成密碼" description="已完成" />
                    <el-step title="加入LINE Bot" :description="lineStepDesc" />
                    <el-step title="輸入密碼" :description="inputStepDesc" />
                    <el-step title="綁定完成" :description="completeStepDesc" />
                  </el-steps>
                </div>
                
                <div class="binding-status">
                  <div class="status-item">
                    <el-text tag="b">剩餘時間:</el-text>
                    <el-text :type="timeRemaining > 120 ? 'primary' : 'danger'">
                      {{ formatTime(timeRemaining) }}
                    </el-text>
                  </div>
                </div>
                
                <div class="action-buttons">
                  <el-button @click="resetBinding">
                    重新生成
                  </el-button>
                  <el-button type="success" @click="checkBindingStatus" :loading="checking">
                    檢查狀態
                  </el-button>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </el-card>

      <!-- 使用說明 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <span>使用說明</span>
        </template>
        
        <el-alert
          title="如何綁定 LINE 帳號"
          type="success"
          :closable="false"
          show-icon
        >
          <p><strong>安全綁定方式：</strong></p>
          <ol>
            <li>點擊「生成綁定密碼」按鈕</li>
            <li>系統將生成一個6位數字密碼和對應的QR碼</li>
            <li>掃描「加好友」QR碼加入LINE Bot (ID: {{ lineBotIdLabel }})</li>
            <li>掃描「綁定密碼」QR碼自動傳送密碼，或手動輸入6位數字密碼</li>
            <li>系統自動完成綁定</li>
          </ol>
          
          <p style="margin-top: 12px;"><strong>特色：</strong></p>
          <ul style="margin-left: 20px;">
            <li>✅ 掃描QR碼自動傳送綁定密碼</li>
            <li>✅ 一鍵加好友，無需搜尋</li>
            <li>✅ 無需手動輸入複雜的User ID</li>
            <li>✅ 10分鐘有效期，更安全</li>
            <li>✅ 即時狀態檢查</li>
            <li>✅ 自動完成綁定</li>
          </ul>
        </el-alert>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Key } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import api from '@/utils/api'

const loading = ref(false)
const binding = ref(false)
const userInfo = ref(null)

// QR Canvas refs
const bindingQrCanvas = ref(null)
const lineBotQrCanvas = ref(null)

// 新的綁定流程變數
const bindingCode = ref('')
const bindingData = ref(null)
const bindingStatus = ref('pending')
const timeRemaining = ref(0)
const generating = ref(false)
const checking = ref(false)
let statusCheckInterval = null
let countdownInterval = null

// 綁定步驟描述
const lineStepDesc = computed(() => {
  return bindingData.value?.line_bot_id ? 
    `加入 ${bindingData.value.line_bot_id}` : 
    '搜尋並加入LINE Bot'
})

const inputStepDesc = computed(() => {
  return bindingStatus.value === 'pending' ? 
    '等待輸入密碼' : 
    bindingStatus.value === 'completed' ? '已輸入密碼' : '等待輸入'
})

const completeStepDesc = computed(() => {
  return bindingStatus.value === 'completed' ? '綁定成功' : '等待完成'
})

const currentBindingStep = computed(() => {
  if (!bindingCode.value) return 0
  if (bindingStatus.value === 'completed') return 4
  if (bindingStatus.value === 'pending') return 2
  return 1
})

const fallbackLineBotId = import.meta.env.VITE_LINE_BOT_ID || ''
const resolvedLineBotId = computed(() => bindingData.value?.line_bot_id || fallbackLineBotId || '')
const lineBotIdLabel = computed(() => resolvedLineBotId.value || '未設定')

// 獲取用戶信息
const getUserInfo = async () => {
  loading.value = true
  try {
    const response = await api.get('/auth/me')
    userInfo.value = response.data.user
    console.log('用戶信息:', userInfo.value)
  } catch (error) {
    console.error('獲取用戶信息失敗:', error)
  } finally {
    loading.value = false
  }
}

// 解除綁定LINE帳號
const unbindLineAccount = async () => {
  try {
    await ElMessageBox.confirm(
      '確定要解除LINE帳號綁定嗎？解除後將無法接收通知。',
      '確認解除綁定',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    binding.value = true
    await api.post('/line/bind', {
      line_user_id: null
    })
    
    ElMessage.success('LINE 帳號解除綁定成功！')
    // 重新獲取用戶信息
    await getUserInfo()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('解除綁定失敗:', error)
      ElMessage.error(error.response?.data?.message || '解除綁定失敗')
    }
  } finally {
    binding.value = false
  }
}

// 生成QR碼
const generateQRCode = async (canvas, text, size = 120) => {
  if (!canvas) return
  
  try {
    await QRCode.toCanvas(canvas, text, {
      width: size,
      height: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
  } catch (error) {
    console.error('生成QR碼失敗:', error)
  }
}

// 生成綁定密碼
const generateBindingCode = async () => {
  generating.value = true
  try {
    const response = await api.post('/line/generate-binding-code')
    bindingCode.value = response.data.binding_code
    bindingData.value = response.data
    timeRemaining.value = response.data.expires_in
    bindingStatus.value = 'pending'
    
    // 等待DOM更新後生成QR碼
    await nextTick()
    
    // 生成綁定密碼QR碼 - 使用LINE oaMessage格式
    const lineBotId = resolvedLineBotId.value
    const bindingUrl = lineBotId
      ? `https://line.me/R/oaMessage/${lineBotId}/?${bindingCode.value}`
      : bindingCode.value
    await generateQRCode(bindingQrCanvas.value, bindingUrl)

    if (lineBotId) {
      const lineAddFriendUrl = `https://line.me/R/ti/p/${lineBotId}`
      await generateQRCode(lineBotQrCanvas.value, lineAddFriendUrl)
    } else if (lineBotQrCanvas.value) {
      const ctx = lineBotQrCanvas.value.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, lineBotQrCanvas.value.width, lineBotQrCanvas.value.height)
      }
    }
    
    // 開始狀態檢查和倒計時
    startStatusCheck()
    startCountdown()
    
    ElMessage.success('綁定密碼和QR碼生成成功！')
  } catch (error) {
    console.error('生成綁定密碼失敗:', error)
    ElMessage.error(error.response?.data?.message || '生成綁定密碼失敗')
  } finally {
    generating.value = false
  }
}

// 檢查綁定狀態
const checkBindingStatus = async () => {
  if (!bindingCode.value) return
  
  checking.value = true
  try {
    const response = await api.get(`/line/binding-status/${bindingCode.value}`)
    const status = response.data.status
    
    bindingStatus.value = status
    
    if (status === 'completed') {
      stopAllTimers()
      await getUserInfo()
      ElMessage.success('LINE帳號綁定成功！')
      resetBinding()
    } else if (status === 'expired' || status === 'not_found') {
      stopAllTimers()
      ElMessage.warning('綁定密碼已過期，請重新生成')
      resetBinding()
    } else {
      timeRemaining.value = response.data.expires_in || 0
    }
  } catch (error) {
    console.error('檢查綁定狀態失敗:', error)
  } finally {
    checking.value = false
  }
}

// 開始狀態檢查
const startStatusCheck = () => {
  stopAllTimers()
  statusCheckInterval = setInterval(checkBindingStatus, 3000) // 每3秒檢查一次
}

// 開始倒計時
const startCountdown = () => {
  countdownInterval = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--
    } else {
      stopAllTimers()
      ElMessage.warning('綁定密碼已過期')
      resetBinding()
    }
  }, 1000)
}

// 停止所有計時器
const stopAllTimers = () => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

// 重置綁定
const resetBinding = () => {
  stopAllTimers()
  bindingCode.value = ''
  bindingData.value = null
  bindingStatus.value = 'pending'
  timeRemaining.value = 0
}

// 格式化時間顯示
const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// 獲取狀態文字
const getStatusText = () => {
  switch (bindingStatus.value) {
    case 'pending':
      return '等待綁定'
    case 'completed':
      return '綁定成功'
    case 'expired':
      return '已過期'
    case 'not_found':
      return '密碼無效'
    default:
      return '未知狀態'
  }
}

// 複製LINE Bot ID
const copyLineBotId = async () => {
  const lineBotId = resolvedLineBotId.value
  if (!lineBotId) {
    ElMessage.warning('尚未設定 LINE Bot ID')
    return
  }
  try {
    await navigator.clipboard.writeText(lineBotId)
    ElMessage.success('LINE Bot ID已複製到剪貼板')
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = lineBotId
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    ElMessage.success('LINE Bot ID已複製到剪貼板')
  }
}

onMounted(() => {
  getUserInfo()
})

// 組件銷毀時清理計時器
onUnmounted(() => {
  stopAllTimers()
})
</script>

<style scoped>
.line-binding-page {
  padding: 20px;
}

.content-container {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.account-card {
  border-radius: 8px;
}

.account-bound, .account-unbound {
  padding: 4px 0;
}

.action-buttons {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.binding-card {
  margin-top: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.binding-content {
  padding: 4px;
}

.binding-code-section {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 20px;
}

.binding-code-display {
  flex: 1;
  text-align: center;
  padding: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 2px solid var(--el-color-primary);
  border-radius: 12px;
  position: relative;
}

.binding-code-display::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  border-radius: 12px;
  z-index: -1;
}

.code-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.binding-code {
  font-size: 32px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 6px;
  margin: 12px 0;
  color: var(--el-color-primary);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.code-hint {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.qr-code-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.line-bot-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  margin-bottom: 16px;
}

.line-bot-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.line-bot-id {
  font-family: monospace;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  font-weight: 500;
}

.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qr-canvas {
  border: 2px solid var(--el-border-color);
  border-radius: 8px;
  background: white;
}

.qr-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.binding-steps {
  margin: 20px 0;
}

.binding-status {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bind-init, .bind-process {
  margin-top: 16px;
}

.el-steps {
  margin: 20px 0;
}

.info-card ol {
  margin: 0;
  padding-left: 20px;
}

.info-card ol li {
  margin-bottom: 8px;
}

.info-card a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.info-card a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .line-binding-page {
    padding: 12px;
  }
  
  .binding-code-section {
    flex-direction: column;
    gap: 16px;
  }
  
  .line-bot-section {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .binding-code {
    font-size: 24px;
    letter-spacing: 3px;
  }
}
</style>
