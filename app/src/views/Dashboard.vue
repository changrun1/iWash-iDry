<template>
  <div class="dashboard">
    <!-- 歡迎卡片 -->
    <el-card class="welcome-card">
      <div class="welcome-content">
        <div class="welcome-text">
          <h2>歡迎回來，{{ authStore.user?.name }}！</h2>
          <p>學號：{{ authStore.user?.student_id }}</p>
          <p class="welcome-subtitle">今天想要使用哪台洗衣機呢？</p>
        </div>
        <div class="welcome-actions">
          <el-button type="primary" size="large" @click="$router.push('/booking')">
            <el-icon><Plus /></el-icon>
            立即預約
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 統計卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon available">
            <el-icon size="24"><Monitor /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ availableMachines }}</div>
            <div class="stat-label">可用洗衣機</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon booking">
            <el-icon size="24"><Calendar /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ weeklyWashing }}/{{ weeklyDrying }}</div>
            <div class="stat-label">本週預約次數</div>
            <div class="stat-sub">洗衣 {{ weeklyWashing }}/2，烘衣 {{ weeklyDrying }}/2</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon active">
            <el-icon size="24"><Timer /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ activeBookings }}</div>
            <div class="stat-label">進行中預約</div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="content-grid">
      <!-- 最近預約 -->
      <el-card class="recent-bookings">
        <template #header>
          <div class="card-header">
            <span>最近預約</span>
            <el-button type="text" @click="$router.push('/my-bookings')">
              查看全部
            </el-button>
          </div>
        </template>

        <div v-if="recentBookings.length === 0" class="empty-state">
          <el-empty description="暫無預約記錄">
            <el-button type="primary" @click="$router.push('/booking')">
              立即預約
            </el-button>
          </el-empty>
        </div>

        <div v-else class="bookings-list">
          <div
            v-for="booking in recentBookings"
            :key="booking.id"
            class="booking-item"
          >
            <div class="booking-info">
              <div class="machine-info">
                <el-tag :type="booking.machine_type === 'washing' ? 'primary' : 'warning'" size="small">
                  {{ booking.machine_type === 'washing' ? '洗衣機' : '烘衣機' }}
                </el-tag>
                <span class="machine-code">{{ booking.machine_code }}</span>
                <span class="location">{{ booking.location }}</span>
              </div>
              <div class="time-info">
                <span class="time">{{ formatDateTime(booking.start_time) }}</span>
                <el-tag :type="getStatusType(booking.status)" size="small">
                  {{ getStatusText(booking.status) }}
                </el-tag>
              </div>
            </div>
            <div class="booking-actions" v-if="booking.status === 'confirmed'">
              <el-button size="small" type="primary" @click="startMachine(booking)">
                開始使用
              </el-button>
              <el-button size="small" @click="cancelBooking(booking.id)">
                取消預約
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 洗衣機狀態 -->
      <el-card class="machine-status">
        <template #header>
          <div class="card-header">
            <span>洗衣機狀態</span>
            <el-button type="text" @click="$router.push('/machines')">
              查看全部
            </el-button>
          </div>
        </template>

        <div class="machines-grid">
          <div
            v-for="machine in topMachines"
            :key="machine.id"
            class="machine-card"
            :class="machine.status"
          >
            <div class="machine-header">
              <span class="machine-code">{{ machine.machine_code }}</span>
              <el-tag
                :type="machine.status === 'available' ? 'success' : machine.status === 'in_use' ? 'warning' : 'danger'"
                size="small"
              >
                {{ getMachineStatusText(machine.status) }}
              </el-tag>
            </div>
            <div class="machine-details">
              <p class="machine-type">
                {{ machine.machine_type === 'washing' ? '洗衣機' : '烘衣機' }}
              </p>
              <p class="machine-location">{{ machine.location }}</p>
              <p v-if="machine.time_left_minutes" class="time-left">
                剩餘 {{ machine.time_left_minutes }} 分鐘
              </p>
            </div>
          </div>
        </div>
      </el-card>
    </div>


  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useMachineStore } from '@/stores/machine'
import { formatDateTime } from '@/utils/date'
import api from '@/utils/api'

const authStore = useAuthStore()
const machineStore = useMachineStore()

const recentBookings = ref([])
const weeklyWashing = ref(0)
const weeklyDrying = ref(0)
const activeBookings = ref(0)

const availableMachines = computed(() => {
  return machineStore.machines.filter(m => m.status === 'available').length
})

const topMachines = computed(() => {
  return machineStore.machines.slice(0, 6)
})

const getStatusType = (status) => {
  const statusMap = {
    'pending': 'info',
    'confirmed': 'success',
    'in_progress': 'warning',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status) => {
  const statusMap = {
    'pending': '待確認',
    'confirmed': '已確認',
    'in_progress': '進行中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status
}

const getMachineStatusText = (status) => {
  const statusMap = {
    'available': '可用',
    'in_use': '使用中',
    'maintenance': '維護中'
  }
  return statusMap[status] || status
}

const fetchDashboardData = async () => {
  try {
    // 獲取最近預約
    const bookingsResponse = await api.get('/booking/my-bookings', {
      params: { limit: 5 }
    })
    recentBookings.value = bookingsResponse.data.bookings

    // 獲取週預約限制
    const limitsResponse = await api.get('/booking/weekly-limits')
    weeklyWashing.value = limitsResponse.data.washing_count
    weeklyDrying.value = limitsResponse.data.drying_count

    // 計算統計數據
    activeBookings.value = recentBookings.value.filter(b => b.status === 'in_progress').length
  } catch (error) {
    console.error('獲取儀表板數據失敗:', error)
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

    await machineStore.startMachine(booking.machine_id)
    ElMessage.success('洗衣機已開始使用')
    
    // 重新獲取數據
    await fetchDashboardData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失敗')
    }
  }
}

const cancelBooking = async (bookingId) => {
  try {
    await ElMessageBox.confirm(
      '確定要取消這個預約嗎？',
      '確認取消',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.put(`/booking/${bookingId}/cancel`)
    ElMessage.success('預約已取消')
    
    // 重新獲取數據
    await fetchDashboardData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '取消失敗')
    }
  }
}

onMounted(async () => {
  await Promise.all([
    machineStore.fetchMachines(),
    fetchDashboardData()
  ])
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  margin-bottom: 24px;
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.welcome-text h2 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.welcome-text p {
  margin: 4px 0;
  color: #666;
}

.welcome-subtitle {
  color: #1890ff !important;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.available {
  background: linear-gradient(45deg, #52c41a, #73d13d);
}

.stat-icon.booking {
  background: linear-gradient(45deg, #1890ff, #40a9ff);
}

.stat-icon.active {
  background: linear-gradient(45deg, #fa8c16, #ffa940);
}

.stat-icon.notification {
  background: linear-gradient(45deg, #eb2f96, #f759ab);
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.stat-sub {
  color: #999;
  font-size: 12px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.booking-item {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.booking-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.machine-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.machine-code {
  font-weight: 600;
  color: #2c3e50;
}

.location {
  color: #666;
  font-size: 14px;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time {
  color: #666;
  font-size: 14px;
}

.booking-actions {
  display: flex;
  gap: 8px;
}

.machines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.machine-card {
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  transition: all 0.3s;
}

.machine-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.machine-card.available {
  border-color: #52c41a;
  background: #f6ffed;
}

.machine-card.in_use {
  border-color: #fa8c16;
  background: #fff7e6;
}

.machine-card.maintenance {
  border-color: #ff4d4f;
  background: #fff2f0;
}

.machine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.machine-code {
  font-weight: 600;
}

.machine-details p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.time-left {
  color: #fa8c16 !important;
  font-weight: 500;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-item:hover {
  background: #e6f7ff;
  transform: translateY(-2px);
}

.action-item span {
  font-size: 14px;
  color: #666;
}

@media (max-width: 768px) {
  .welcome-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .machines-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
