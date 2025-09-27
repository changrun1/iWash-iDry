<template>
  <div class="payment-page">
    <div class="page-header">
      <h2>付款處理</h2>
      <el-steps :active="currentStep" align-center style="max-width: 600px">
        <el-step title="選擇付款方式" />
        <el-step title="確認付款" />
        <el-step title="付款完成" />
      </el-steps>
    </div>

    <!-- 步驟1: 選擇付款方式 -->
    <div v-if="currentStep === 0" class="payment-step">
      <el-card class="booking-info-card">
        <template #header>
          <span>預約資訊</span>
        </template>
        
        <div v-if="bookingInfo" class="booking-details">
          <div class="detail-row">
            <span class="label">洗衣機:</span>
            <span class="value">{{ bookingInfo.machine_code }} - {{ bookingInfo.location }}</span>
          </div>
          <div class="detail-row">
            <span class="label">使用時間:</span>
            <span class="value">{{ formatDateTime(bookingInfo.start_time) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">使用時長:</span>
            <span class="value">{{ bookingInfo.duration }} 分鐘</span>
          </div>
          <div class="detail-row">
            <span class="label">費用:</span>
            <span class="value price">${{ bookingInfo.price }}</span>
          </div>
        </div>
      </el-card>

      <el-card class="payment-methods-card">
        <template #header>
          <span>選擇付款方式</span>
        </template>

        <div class="payment-methods">
          <div
            v-for="method in paymentMethods"
            :key="method.id"
            :class="['payment-method', { active: selectedMethod === method.id }]"
            @click="selectedMethod = method.id"
          >
            <div class="method-icon">
              <el-icon :size="32">
                <component :is="method.icon" />
              </el-icon>
            </div>
            <div class="method-info">
              <h4>{{ method.name }}</h4>
              <p>{{ method.description }}</p>
              <div v-if="method.discount" class="discount">
                <el-tag type="success" size="small">
                  {{ method.discount }}
                </el-tag>
              </div>
            </div>
            <div class="method-price">
              <span v-if="method.fee" class="fee">手續費: ${{ method.fee }}</span>
              <span class="total">${{ calculateTotal(method) }}</span>
            </div>
          </div>
        </div>

        <!-- 優惠券 -->
        <div class="coupon-section">
          <h4>優惠券</h4>
          <div class="coupon-input">
            <el-input
              v-model="couponCode"
              placeholder="請輸入優惠券代碼"
              style="width: 200px"
            >
              <template #append>
                <el-button @click="applyCoupon" :loading="applyingCoupon">
                  使用
                </el-button>
              </template>
            </el-input>
          </div>
          
          <div v-if="appliedCoupon" class="applied-coupon">
            <el-tag type="success" closable @close="removeCoupon">
              {{ appliedCoupon.name }} (-${{ appliedCoupon.discount }})
            </el-tag>
          </div>
        </div>

        <div class="step-actions">
          <el-button type="primary" @click="nextStep" :disabled="!selectedMethod">
            下一步
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 步驟2: 確認付款 -->
    <div v-if="currentStep === 1" class="payment-step">
      <el-card class="payment-confirm-card">
        <template #header>
          <span>確認付款資訊</span>
        </template>

        <div class="payment-summary">
          <div class="summary-row">
            <span>基本費用:</span>
            <span>${{ bookingInfo?.price || 0 }}</span>
          </div>
          <div v-if="selectedMethodInfo?.fee" class="summary-row">
            <span>手續費:</span>
            <span>${{ selectedMethodInfo.fee }}</span>
          </div>
          <div v-if="appliedCoupon" class="summary-row discount">
            <span>優惠券折扣:</span>
            <span>-${{ appliedCoupon.discount }}</span>
          </div>
          <div class="summary-row total">
            <span>總計:</span>
            <span>${{ finalAmount }}</span>
          </div>
        </div>

        <div class="payment-method-display">
          <h4>付款方式: {{ selectedMethodInfo?.name }}</h4>
          <p>{{ selectedMethodInfo?.description }}</p>
        </div>

        <!-- 根據不同付款方式顯示不同表單 -->
        <div v-if="selectedMethod === 'credit_card'" class="payment-form">
          <el-form :model="creditCardForm" :rules="creditCardRules" ref="creditCardFormRef">
            <el-form-item label="卡號" prop="cardNumber">
              <el-input
                v-model="creditCardForm.cardNumber"
                placeholder="1234 5678 9012 3456"
                maxlength="19"
                @input="formatCardNumber"
              />
            </el-form-item>
            <div style="display: flex; gap: 16px;">
              <el-form-item label="有效期限" prop="expiry" style="flex: 1;">
                <el-input
                  v-model="creditCardForm.expiry"
                  placeholder="MM/YY"
                  maxlength="5"
                  @input="formatExpiry"
                />
              </el-form-item>
              <el-form-item label="安全碼" prop="cvv" style="flex: 1;">
                <el-input
                  v-model="creditCardForm.cvv"
                  placeholder="123"
                  maxlength="4"
                  show-password
                />
              </el-form-item>
            </div>
            <el-form-item label="持卡人姓名" prop="holderName">
              <el-input
                v-model="creditCardForm.holderName"
                placeholder="請輸入持卡人姓名"
              />
            </el-form-item>
          </el-form>
        </div>

        <div v-else-if="selectedMethod === 'line_pay'" class="payment-info">
          <el-alert
            title="LINE Pay 付款"
            description="點擊確認付款後將跳轉到 LINE Pay 頁面完成付款"
            type="info"
            show-icon
            :closable="false"
          />
        </div>

        <div v-else-if="selectedMethod === 'atm'" class="payment-info">
          <el-alert
            title="ATM 轉帳"
            description="點擊確認付款後將顯示轉帳資訊，請在24小時內完成轉帳"
            type="warning"
            show-icon
            :closable="false"
          />
        </div>

        <div class="step-actions">
          <el-button @click="prevStep">上一步</el-button>
          <el-button 
            type="primary" 
            @click="confirmPayment"
            :loading="processing"
          >
            確認付款
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 步驟3: 付款完成 -->
    <div v-if="currentStep === 2" class="payment-step">
      <el-card class="payment-result-card">
        <div class="payment-result">
          <div v-if="paymentResult.success" class="success-result">
            <el-icon size="80" color="#52c41a">
              <SuccessFilled />
            </el-icon>
            <h3>付款成功！</h3>
            <p>您的預約已確認，感謝您的使用</p>
            
            <div class="payment-details">
              <div class="detail-row">
                <span>付款金額:</span>
                <span>${{ paymentResult.amount }}</span>
              </div>
              <div class="detail-row">
                <span>交易編號:</span>
                <span>{{ paymentResult.transaction_id }}</span>
              </div>
              <div class="detail-row">
                <span>付款時間:</span>
                <span>{{ formatDateTime(paymentResult.paid_at) }}</span>
              </div>
            </div>
          </div>

          <div v-else class="failed-result">
            <el-icon size="80" color="#ff4d4f">
              <CircleCloseFilled />
            </el-icon>
            <h3>付款失敗</h3>
            <p>{{ paymentResult.error || '付款過程中發生錯誤，請重試' }}</p>
          </div>

          <div class="result-actions">
            <el-button v-if="paymentResult.success" type="primary" @click="goToBookings">
              查看我的預約
            </el-button>
            <el-button v-else type="primary" @click="retryPayment">
              重新付款
            </el-button>
            <el-button @click="goHome">返回首頁</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { formatDateTime } from '@/utils/date'
import api from '@/utils/api'

const router = useRouter()
const route = useRoute()

const currentStep = ref(0)
const selectedMethod = ref('')
const couponCode = ref('')
const appliedCoupon = ref(null)
const applyingCoupon = ref(false)
const processing = ref(false)
const bookingInfo = ref(null)
const paymentResult = ref({})

const creditCardForm = reactive({
  cardNumber: '',
  expiry: '',
  cvv: '',
  holderName: ''
})

const paymentMethods = ref([
  {
    id: 'credit_card',
    name: '信用卡',
    description: '支援 Visa、MasterCard、JCB',
    icon: 'CreditCard',
    fee: 0
  },
  {
    id: 'line_pay',
    name: 'LINE Pay',
    description: '使用 LINE Pay 快速付款',
    icon: 'Message',
    fee: 0,
    discount: '首次使用享9折優惠'
  },
  {
    id: 'atm',
    name: 'ATM 轉帳',
    description: '24小時內完成轉帳',
    icon: 'Money',
    fee: 5
  },
  {
    id: 'wallet',
    name: '校園錢包',
    description: '使用學生證餘額付款',
    icon: 'Wallet',
    fee: 0
  }
])

const selectedMethodInfo = computed(() => 
  paymentMethods.value.find(m => m.id === selectedMethod.value)
)

const finalAmount = computed(() => {
  if (!bookingInfo.value) return 0
  
  let amount = bookingInfo.value.price
  
  // 加上手續費
  if (selectedMethodInfo.value?.fee) {
    amount += selectedMethodInfo.value.fee
  }
  
  // 減去優惠券折扣
  if (appliedCoupon.value) {
    amount -= appliedCoupon.value.discount
  }
  
  return Math.max(0, amount)
})

const creditCardRules = {
  cardNumber: [
    { required: true, message: '請輸入卡號', trigger: 'blur' },
    { min: 19, message: '請輸入完整卡號', trigger: 'blur' }
  ],
  expiry: [
    { required: true, message: '請輸入有效期限', trigger: 'blur' },
    { pattern: /^(0[1-9]|1[0-2])\/\d{2}$/, message: '請輸入正確格式 MM/YY', trigger: 'blur' }
  ],
  cvv: [
    { required: true, message: '請輸入安全碼', trigger: 'blur' },
    { min: 3, message: '安全碼至少3位數', trigger: 'blur' }
  ],
  holderName: [
    { required: true, message: '請輸入持卡人姓名', trigger: 'blur' }
  ]
}

const calculateTotal = (method) => {
  if (!bookingInfo.value) return 0
  
  let total = bookingInfo.value.price + (method.fee || 0)
  
  if (appliedCoupon.value) {
    total -= appliedCoupon.value.discount
  }
  
  return Math.max(0, total)
}

const formatCardNumber = () => {
  let value = creditCardForm.cardNumber.replace(/\s/g, '').replace(/[^0-9]/gi, '')
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value
  creditCardForm.cardNumber = formattedValue
}

const formatExpiry = () => {
  let value = creditCardForm.expiry.replace(/\D/g, '')
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4)
  }
  creditCardForm.expiry = value
}

const nextStep = () => {
  if (currentStep.value < 2) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const applyCoupon = async () => {
  if (!couponCode.value.trim()) {
    ElMessage.warning('請輸入優惠券代碼')
    return
  }

  applyingCoupon.value = true
  try {
    const response = await api.post('/payment/apply-coupon', {
      code: couponCode.value,
      booking_id: route.query.bookingId
    })
    
    appliedCoupon.value = response.data.coupon
    ElMessage.success('優惠券已套用')
    couponCode.value = ''
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '優惠券無效')
  } finally {
    applyingCoupon.value = false
  }
}

const removeCoupon = () => {
  appliedCoupon.value = null
  ElMessage.info('已移除優惠券')
}

const confirmPayment = async () => {
  if (selectedMethod.value === 'credit_card') {
    // 驗證信用卡表單
    const valid = await new Promise((resolve) => {
      creditCardFormRef.value?.validate((valid) => resolve(valid))
    })
    
    if (!valid) return
  }

  processing.value = true
  try {
    const paymentData = {
      booking_id: route.query.bookingId,
      payment_method: selectedMethod.value,
      amount: finalAmount.value,
      coupon_id: appliedCoupon.value?.id
    }

    if (selectedMethod.value === 'credit_card') {
      paymentData.card_info = creditCardForm
    }

    const response = await api.post('/payment/process', paymentData)
    
    paymentResult.value = response.data
    currentStep.value = 2
    
    if (response.data.success) {
      ElMessage.success('付款成功！')
    }
  } catch (error) {
    paymentResult.value = {
      success: false,
      error: error.response?.data?.message || '付款失敗'
    }
    currentStep.value = 2
    ElMessage.error('付款失敗')
  } finally {
    processing.value = false
  }
}

const retryPayment = () => {
  currentStep.value = 0
  paymentResult.value = {}
}

const goToBookings = () => {
  router.push('/my-bookings')
}

const goHome = () => {
  router.push('/dashboard')
}

const loadBookingInfo = async () => {
  const bookingId = route.query.bookingId
  if (!bookingId) {
    ElMessage.error('缺少預約資訊')
    router.push('/my-bookings')
    return
  }

  try {
    const response = await api.get(`/booking/${bookingId}`)
    bookingInfo.value = response.data.booking
  } catch (error) {
    ElMessage.error('載入預約資訊失敗')
    router.push('/my-bookings')
  }
}

onMounted(() => {
  loadBookingInfo()
})
</script>

<style scoped>
.payment-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h2 {
  margin: 0 0 24px 0;
  color: #2c3e50;
  text-align: center;
}

.payment-step {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.booking-info-card,
.payment-methods-card,
.payment-confirm-card,
.payment-result-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.booking-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #666;
  font-weight: 500;
}

.value {
  color: #2c3e50;
}

.price {
  color: #1890ff;
  font-weight: 600;
  font-size: 18px;
}

.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.payment-method {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 2px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.payment-method:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
}

.payment-method.active {
  border-color: #1890ff;
  background: #f0f9ff;
}

.method-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 8px;
  color: #1890ff;
}

.method-info {
  flex: 1;
}

.method-info h4 {
  margin: 0 0 4px 0;
  color: #2c3e50;
}

.method-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.discount {
  margin-top: 4px;
}

.method-price {
  text-align: right;
}

.fee {
  display: block;
  color: #999;
  font-size: 12px;
}

.total {
  color: #1890ff;
  font-weight: 600;
  font-size: 16px;
}

.coupon-section {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 24px;
}

.coupon-section h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
}

.coupon-input {
  margin-bottom: 12px;
}

.applied-coupon {
  display: flex;
  gap: 8px;
}

.payment-summary {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.summary-row.discount {
  color: #52c41a;
}

.summary-row.total {
  font-weight: 600;
  font-size: 18px;
  color: #2c3e50;
  border-top: 1px solid #e8e8e8;
  padding-top: 8px;
  margin-top: 8px;
}

.payment-method-display {
  margin-bottom: 20px;
  padding: 16px;
  background: #f0f9ff;
  border-radius: 8px;
}

.payment-method-display h4 {
  margin: 0 0 8px 0;
  color: #1890ff;
}

.payment-form {
  margin-bottom: 20px;
}

.payment-info {
  margin-bottom: 20px;
}

.payment-result {
  text-align: center;
  padding: 40px 0;
}

.success-result h3,
.failed-result h3 {
  margin: 16px 0 8px 0;
  font-size: 24px;
}

.success-result h3 {
  color: #52c41a;
}

.failed-result h3 {
  color: #ff4d4f;
}

.success-result p,
.failed-result p {
  margin: 0 0 24px 0;
  color: #666;
}

.payment-details {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin: 24px 0;
  text-align: left;
}

.payment-details .detail-row {
  margin-bottom: 12px;
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

@media (max-width: 768px) {
  .payment-method {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .method-price {
    text-align: center;
  }

  .step-actions,
  .result-actions {
    flex-direction: column;
  }

  .payment-form .el-form-item {
    margin-bottom: 16px;
  }
}
</style>
