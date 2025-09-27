<template>
  <div class="my-bookings-page">
    <div class="page-header">
      <h2>我的預約</h2>
      <div class="header-actions">
        <el-button type="primary" @click="$router.push('/booking')">
          <el-icon><Plus /></el-icon>
          新增預約
        </el-button>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ weeklyBookings }}</div>
          <div class="stat-label">本週預約</div>
          <div class="stat-sub">剩餘 {{ 2 - weeklyBookings }} 次</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ activeBookings }}</div>
          <div class="stat-label">進行中</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ totalBookings }}</div>
          <div class="stat-label">總預約數</div>
        </div>
      </el-card>
    </div>

    <!-- 篩選器 -->
    <el-card class="filter-card">
      <div class="filters">
        <el-select v-model="statusFilter" placeholder="狀態篩選" clearable @change="loadBookings">
          <el-option label="全部狀態" value="" />
          <el-option label="已確認" value="confirmed" />
          <el-option label="進行中" value="in_progress" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
          @change="loadBookings"
        />

        <el-button @click="loadBookings" :loading="loading">
          <el-icon><Refresh /></el-icon>
          重新整理
        </el-button>
      </div>
    </el-card>

    <!-- 預約列表 -->
    <el-card class="bookings-card">
      <template #header>
        <div class="card-header">
          <span>預約記錄</span>
          <el-tag type="info">共 {{ bookings.length }} 筆</el-tag>
        </div>
      </template>

      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="bookings.length === 0" class="empty-state">
        <el-empty description="暫無預約記錄">
          <el-button type="primary" @click="$router.push('/booking')">
            立即預約
          </el-button>
        </el-empty>
      </div>

      <div v-else class="bookings-list">
        <div
          v-for="booking in bookings"
          :key="booking.id"
          class="booking-item"
          :class="booking.status"
        >
          <div class="booking-header">
            <div class="machine-info">
              <h4>{{ booking.machine_code }}</h4>
              <el-tag :type="booking.machine_type === 'washing' ? 'primary' : 'warning'" size="small">
                {{ booking.machine_type === 'washing' ? '洗衣機' : '烘衣機' }}
              </el-tag>
              <span class="location">{{ booking.location }}</span>
            </div>
            <div class="status-info">
              <el-tag :type="getStatusTagType(booking.status)">
                {{ getStatusText(booking.status) }}
              </el-tag>
            </div>
          </div>

          <div class="booking-details">
            <div class="detail-row">
              <el-icon><Calendar /></el-icon>
              <span>{{ formatDate(booking.start_time) }}</span>
            </div>
            <div class="detail-row">
              <el-icon><Clock /></el-icon>
              <span>{{ formatTime(booking.start_time) }} - {{ formatTime(booking.end_time) }}</span>
            </div>
            <div class="detail-row">
              <el-icon><Timer /></el-icon>
              <span>{{ calculateDuration(booking.start_time, booking.end_time) }} 分鐘</span>
            </div>
            <div class="detail-row">
              <el-icon><Money /></el-icon>
              <span>{{ booking.payment_amount }} 元</span>
              <el-tag 
                :type="booking.payment_status === 'paid' ? 'success' : booking.payment_status === 'refunded' ? 'warning' : 'danger'" 
                size="small"
              >
                {{ getPaymentStatusText(booking.payment_status) }}
              </el-tag>
            </div>
            <!-- 六位密碼顯示 -->
            <div v-if="booking.access_code && (booking.status === 'confirmed' || booking.status === 'in_progress')" class="detail-row access-code-row">
              <el-icon><Lock /></el-icon>
              <span>密碼: </span>
              <el-tag type="danger" size="small" style="font-family: monospace; font-weight: bold;">
                {{ booking.access_code }}
              </el-tag>
            </div>
          </div>

          <!-- 時間進度條（僅進行中顯示） -->
          <div v-if="booking.status === 'in_progress'" class="progress-section">
            <div class="progress-info">
              <span>使用進度</span>
              <span>{{ getTimeRemaining(booking.end_time) }}</span>
            </div>
            <el-progress
              :percentage="getProgressPercentage(booking.start_time, booking.end_time)"
              :color="getProgressColor(booking.start_time, booking.end_time)"
              :stroke-width="6"
            />
          </div>

          <div class="booking-actions">
            <!-- 確認狀態的預約 -->
            <template v-if="booking.status === 'confirmed'">
              <el-button
                type="primary"
                size="small"
                @click="startMachine(booking)"
                :disabled="!canStartMachine(booking)"
              >
                開始使用
              </el-button>
              <el-button
                size="small"
                @click="cancelBooking(booking)"
                :disabled="!canCancelBooking(booking)"
              >
                取消預約
              </el-button>
              <el-button
                v-if="booking.payment_status === 'unpaid'"
                type="success"
                size="small"
                @click="payBooking(booking)"
              >
                立即付款
              </el-button>
            </template>

            <!-- 進行中的預約 -->
            <template v-if="booking.status === 'in_progress'">
              <el-button type="info" size="small" disabled>
                使用中...
              </el-button>
            </template>

            <!-- 已完成的預約 -->
            <template v-if="booking.status === 'completed'">
              <el-button size="small" @click="viewBookingDetails(booking)">
                查看詳情
              </el-button>
              <el-button
                v-if="booking.payment_status === 'paid'"
                type="warning"
                size="small"
                @click="requestRefund(booking)"
                :disabled="!canRequestRefund(booking)"
              >
                申請退款
              </el-button>
            </template>

            <!-- 已取消的預約 -->
            <template v-if="booking.status === 'cancelled'">
              <el-button size="small" @click="viewBookingDetails(booking)">
                查看詳情
              </el-button>
            </template>
          </div>

          <div class="booking-footer">
            <span class="created-time">預約時間: {{ formatDateTime(booking.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- 分頁 -->
      <div v-if="bookings.length > 0" class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="totalCount"
          layout="prev, pager, next, total"
          @current-change="loadBookings"
        />
      </div>
    </el-card>

    <!-- 預約詳情對話框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="預約詳情"
      width="600px"
    >
      <div v-if="selectedBooking" class="booking-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="預約編號">
            #{{ selectedBooking.id }}
          </el-descriptions-item>
          <el-descriptions-item label="洗衣機">
            {{ selectedBooking.machine_code }} ({{ selectedBooking.machine_type === 'washing' ? '洗衣機' : '烘衣機' }})
          </el-descriptions-item>
          <el-descriptions-item label="位置">
            {{ selectedBooking.location }}
          </el-descriptions-item>
          <el-descriptions-item label="預約日期">
            {{ formatDate(selectedBooking.start_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="使用時間">
            {{ formatTime(selectedBooking.start_time) }} - {{ formatTime(selectedBooking.end_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="狀態">
            <el-tag :type="getStatusTagType(selectedBooking.status)">
              {{ getStatusText(selectedBooking.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="付款狀態">
            <el-tag :type="selectedBooking.payment_status === 'paid' ? 'success' : 'danger'">
              {{ getPaymentStatusText(selectedBooking.payment_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="費用">
            {{ selectedBooking.payment_amount }} 元
          </el-descriptions-item>
          <el-descriptions-item label="六位密碼" v-if="selectedBooking.access_code && (selectedBooking.status === 'confirmed' || selectedBooking.status === 'in_progress')">
            <el-tag type="danger" size="large" style="font-family: monospace; font-size: 16px; font-weight: bold;">
              {{ selectedBooking.access_code }}
            </el-tag>
            <div style="margin-top: 8px; font-size: 12px; color: #666;">
              請在洗衣機上輸入此密碼開始使用
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="付款方式" v-if="selectedBooking.payment_method">
            {{ selectedBooking.payment_method }}
          </el-descriptions-item>
          <el-descriptions-item label="預約時間">
            {{ formatDateTime(selectedBooking.created_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatDate, formatTime, formatDateTime } from '@/utils/date'
import api from '@/utils/api'

const bookings = ref([])
const loading = ref(false)
const statusFilter = ref('')
const dateRange = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)
const showDetailDialog = ref(false)
const selectedBooking = ref(null)

const weeklyBookings = computed(() => 
  bookings.value.filter(b => isThisWeek(b.created_at) && b.status !== 'cancelled').length
)

const activeBookings = computed(() =>
  bookings.value.filter(b => b.status === 'in_progress').length
)

const totalBookings = computed(() => bookings.value.length)

const isThisWeek = (date) => {
  const now = new Date()
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
  const bookingDate = new Date(date)
  return bookingDate >= weekStart
}

const getStatusTagType = (status) => {
  const typeMap = {
    'pending': 'info',
    'confirmed': 'success',
    'in_progress': 'warning',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    'pending': '待確認',
    'confirmed': '已確認',
    'in_progress': '進行中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return textMap[status] || status
}

const getPaymentStatusText = (status) => {
  const textMap = {
    'unpaid': '未付款',
    'paid': '已付款',
    'refunded': '已退款'
  }
  return textMap[status] || status
}

const calculateDuration = (startTime, endTime) => {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return Math.round((end - start) / (1000 * 60))
}

const getTimeRemaining = (endTime) => {
  const now = new Date()
  const end = new Date(endTime)
  const diff = end - now
  
  if (diff <= 0) return '已完成'
  
  const minutes = Math.ceil(diff / (1000 * 60))
  if (minutes < 60) return `剩餘 ${minutes} 分鐘`
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `剩餘 ${hours} 小時 ${mins} 分鐘`
}

const getProgressPercentage = (startTime, endTime) => {
  const now = new Date()
  const start = new Date(startTime)
  const end = new Date(endTime)
  
  const total = end - start
  const elapsed = now - start
  
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

const getProgressColor = (startTime, endTime) => {
  const progress = getProgressPercentage(startTime, endTime)
  if (progress < 50) return '#67c23a'
  if (progress < 80) return '#e6a23c'
  return '#f56c6c'
}

const canStartMachine = (booking) => {
  const now = new Date()
  const startTime = new Date(booking.start_time)
  const timeDiff = startTime - now
  
  // 開始時間前15分鐘內可以開始使用
  return timeDiff <= 15 * 60 * 1000 && timeDiff >= -5 * 60 * 1000
}

const canCancelBooking = (booking) => {
  const now = new Date()
  const startTime = new Date(booking.start_time)
  const timeDiff = startTime - now
  
  // 開始時間前30分鐘可以取消
  return timeDiff > 30 * 60 * 1000
}

const canRequestRefund = (booking) => {
  // 已完成且已付款的預約可以申請退款（根據業務規則調整）
  return booking.payment_status === 'paid' && booking.status === 'completed'
}

const loadBookings = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value
    }
    
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = formatDate(dateRange.value[0])
      params.end_date = formatDate(dateRange.value[1])
    }

    const response = await api.get('/booking/my-bookings', { params })
    bookings.value = response.data.bookings
    totalCount.value = response.data.pagination?.total || bookings.value.length
  } catch (error) {
    ElMessage.error('獲取預約記錄失敗')
  } finally {
    loading.value = false
  }
}

const startMachine = async (booking) => {
  try {
    await ElMessageBox.confirm(
      `確定要開始使用 ${booking.machine_code} 嗎？`,
      '確認開始使用',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )

    await api.post(`/machine/${booking.machine_id}/start`)
    ElMessage.success('洗衣機已開始使用')
    
    await loadBookings()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失敗')
    }
  }
}

const cancelBooking = async (booking) => {
  try {
    await ElMessageBox.confirm(
      '確定要取消這個預約嗎？取消後將無法恢復。',
      '確認取消',
      {
        confirmButtonText: '確定取消',
        cancelButtonText: '保留預約',
        type: 'warning'
      }
    )

    await api.put(`/booking/${booking.id}/cancel`)
    ElMessage.success('預約已取消')
    
    await loadBookings()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '取消失敗')
    }
  }
}

const payBooking = (booking) => {
  // 跳轉到付款頁面
  this.$router.push({
    path: '/payment',
    query: { bookingId: booking.id }
  })
}

const requestRefund = async (booking) => {
  try {
    await ElMessageBox.prompt('請輸入退款原因', '申請退款', {
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      inputValidator: (value) => {
        if (!value || value.trim().length < 5) {
          return '請輸入至少5個字符的退款原因'
        }
        return true
      }
    })

    // 這裡應該調用退款API
    ElMessage.success('退款申請已提交，將在3-5個工作日內處理')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('提交失敗')
    }
  }
}

const viewBookingDetails = (booking) => {
  selectedBooking.value = booking
  showDetailDialog.value = true
}

onMounted(() => {
  loadBookings()
})
</script>

<style scoped>
.my-bookings-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  color: #2c3e50;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
}

.stat-content {
  padding: 10px;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 8px;
}

.stat-label {
  color: #666;
  font-size: 14px;
  margin-bottom: 4px;
}

.stat-sub {
  color: #999;
  font-size: 12px;
}

.filter-card {
  margin-bottom: 24px;
}

.filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.bookings-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading-state {
  padding: 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.booking-item {
  padding: 20px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  margin-bottom: 16px;
  transition: all 0.3s;
}

.booking-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.booking-item.confirmed {
  border-left: 4px solid #52c41a;
}

.booking-item.in_progress {
  border-left: 4px solid #fa8c16;
}

.booking-item.completed {
  border-left: 4px solid #1890ff;
}

.booking-item.cancelled {
  border-left: 4px solid #ff4d4f;
  opacity: 0.7;
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.machine-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.machine-info h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.location {
  color: #666;
  font-size: 14px;
}

.booking-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
}

.access-code-row {
  background: #fff7e6;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ffd591;
  font-weight: 500;
}

.progress-section {
  margin: 16px 0;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.booking-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.booking-footer {
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.booking-detail {
  max-height: 400px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters {
    flex-direction: column;
  }

  .booking-header {
    flex-direction: column;
    gap: 12px;
  }

  .machine-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .booking-details {
    grid-template-columns: 1fr;
  }

  .booking-actions {
    flex-direction: column;
  }
}
</style>
