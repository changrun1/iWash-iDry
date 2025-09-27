<template>
  <div class="machines-page">
    <div class="page-header">
      <h2>洗衣機狀態</h2>
      <div class="header-actions">
        <el-button @click="refreshMachines" :loading="machineStore.loading">
          <el-icon><Refresh /></el-icon>
          重新整理
        </el-button>
      </div>
    </div>

    <!-- 篩選器 -->
    <el-card class="filter-card">
      <div class="filters">
        <div class="filter-group">
          <label>區域：</label>
          <el-select 
            v-model="filters.region" 
            placeholder="全部區域" 
            clearable 
            @change="onRegionChange"
            style="min-width: 120px;"
          >
            <el-option label="全部區域" value="" />
            <el-option
              v-for="region in machineStore.allRegions"
              :key="region"
              :label="region"
              :value="region"
            />
          </el-select>
        </div>

        <div class="filter-group">
          <label>位置：</label>
          <el-select 
            v-model="filters.location" 
            placeholder="全部位置" 
            clearable 
            @change="applyFilters"
            style="min-width: 200px;"
          >
            <el-option label="全部位置" value="" />
            <el-option
              v-for="location in availableLocations"
              :key="location"
              :label="location"
              :value="location"
            />
          </el-select>
        </div>

        <div class="filter-group">
          <label>類型：</label>
          <el-select v-model="filters.machine_type" placeholder="全部類型" clearable @change="applyFilters">
            <el-option label="全部類型" value="" />
            <el-option label="洗衣機" value="washer" />
            <el-option label="烘衣機" value="dryer" />
          </el-select>
        </div>

        <div class="filter-group">
          <label>狀態：</label>
          <el-select v-model="filters.status" placeholder="全部狀態" clearable @change="applyFilters">
            <el-option label="全部狀態" value="" />
            <el-option label="可用" value="available" />
            <el-option label="使用中" value="in_use" />
            <el-option label="維護中" value="maintenance" />
          </el-select>
        </div>
      </div>

      <!-- 狀態統計 -->
      <div class="status-summary">
        <div class="summary-item">
          <span class="label">在線區域：</span>
          <span class="value">{{ machineStore.onlineRegions }}</span>
        </div>
        <div class="summary-item">
          <span class="label">總計：</span>
          <span class="value">{{ filteredMachines.length }}</span>
        </div>
        <div class="summary-item available">
          <span class="label">可用：</span>
          <span class="value">{{ availableCount }}</span>
        </div>
        <div class="summary-item occupied">
          <span class="label">使用中：</span>
          <span class="value">{{ occupiedCount }}</span>
        </div>
        <div class="summary-item locked">
          <span class="label">鎖定中：</span>
          <span class="value">{{ lockedCount }}</span>
        </div>
        <div class="summary-item maintenance">
          <span class="label">維修中：</span>
          <span class="value">{{ maintenanceCount }}</span>
        </div>
      </div>
    </el-card>

    <!-- 洗衣機列表 -->
    <div class="machines-grid">
      <el-card
        v-for="machine in filteredMachines"
        :key="machine.id"
        class="machine-card"
        :class="machine.status"
        shadow="hover"
      >
        <div class="machine-header">
          <div class="machine-title">
            <h3>{{ machine.machine_code }}</h3>
            <el-tag
              :type="getStatusTagType(machine.status)"
              size="small"
            >
              {{ getStatusText(machine.status) }}
            </el-tag>
          </div>
          <div class="machine-type">
            <el-icon size="20">
              <component :is="machine.machine_type === 'washing' ? 'Setting' : 'Timer'" />
            </el-icon>
          </div>
        </div>

        <div class="machine-info">
          <div class="info-item">
            <el-icon><Location /></el-icon>
            <span>{{ machine.region }} - {{ machine.location }}</span>
          </div>
          
          <div class="info-item">
            <el-icon><Grid /></el-icon>
            <span>{{ machine.machine_type === 'washer' ? '洗衣機' : '烘衣機' }}</span>
          </div>

          <div v-if="machine.status === 'in_use'" class="info-item time-info">
            <el-icon><Timer /></el-icon>
            <span v-if="machine.time_left_minutes > 0" class="time-left">
              剩餘 {{ machine.time_left_minutes }} 分鐘
            </span>
            <span v-else class="time-up">即將完成</span>
          </div>

          <div v-if="machine.current_user_name" class="info-item user-info">
            <el-icon><User /></el-icon>
            <span>{{ machine.current_user_name }}</span>
          </div>
        </div>

        <div class="machine-actions">
          <el-button
            v-if="machine.status === 'available'"
            type="primary"
            size="small"
            @click="bookMachine(machine)"
          >
            立即預約
          </el-button>
          
          <el-button
            v-if="machine.status === 'in_use' && machine.current_user_student_id === authStore.user?.student_id"
            type="warning"
            size="small"
            @click="viewBookingDetails(machine)"
          >
            查看詳情
          </el-button>
          
          <el-button
            size="small"
            @click="viewTodayBookings(machine)"
          >
            今日預約
          </el-button>
        </div>

        <!-- 進度條（僅使用中顯示） -->
        <div v-if="machine.status === 'in_use'" class="progress-section">
          <el-progress
            :percentage="getProgress(machine)"
            :color="getProgressColor(machine)"
            :stroke-width="6"
          />
        </div>
      </el-card>
    </div>

    <!-- 空狀態 -->
    <div v-if="filteredMachines.length === 0" class="empty-state">
      <el-empty 
        :description="machineStore.machines.length === 0 ? '沒有硬體控制器在線，無法顯示洗衣機' : '沒有找到符合條件的洗衣機'"
      >
        <el-button v-if="machineStore.machines.length > 0" @click="clearFilters">清除篩選條件</el-button>
        <el-button v-else @click="refreshMachines">重新檢查</el-button>
      </el-empty>
    </div>

    <!-- 今日預約對話框 -->
    <el-dialog
      v-model="showBookingsDialog"
      :title="`${selectedMachine?.machine_code} - 今日預約`"
      width="600px"
    >
      <div v-if="todayBookings.length === 0" class="empty-bookings">
        <el-empty description="今日暫無預約" />
      </div>
      <div v-else class="bookings-timeline">
        <div
          v-for="booking in todayBookings"
          :key="booking.id"
          class="booking-timeline-item"
          :class="booking.status"
        >
          <div class="timeline-time">
            {{ formatTime(booking.start_time) }} - {{ formatTime(booking.end_time) }}
          </div>
          <div class="timeline-content">
            <div class="booking-user">{{ booking.user_name }}</div>
            <el-tag :type="getStatusTagType(booking.status)" size="small">
              {{ getStatusText(booking.status) }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useMachineStore } from '@/stores/machine'
import { formatTime } from '@/utils/date'
import api from '@/utils/api'

const router = useRouter()
const authStore = useAuthStore()
const machineStore = useMachineStore()

const filters = ref({
  region: '',
  location: '',
  machine_type: '',
  status: ''
})

const showBookingsDialog = ref(false)
const selectedMachine = ref(null)
const todayBookings = ref([])

const filteredMachines = computed(() => {
  let machines = machineStore.machines

  if (filters.value.region) {
    machines = machines.filter(m => m.region === filters.value.region)
  }

  if (filters.value.location) {
    machines = machines.filter(m => m.location === filters.value.location)
  }

  if (filters.value.machine_type) {
    machines = machines.filter(m => m.machine_type === filters.value.machine_type)
  }

  if (filters.value.status) {
    machines = machines.filter(m => m.status === filters.value.status)
  }

  return machines
})

const availableCount = computed(() => 
  filteredMachines.value.filter(m => m.status === 'available').length
)

const occupiedCount = computed(() => 
  filteredMachines.value.filter(m => m.status === 'in_use').length
)

const maintenanceCount = computed(() => 
  filteredMachines.value.filter(m => m.status === 'maintenance').length
)

const lockedCount = computed(() => 
  filteredMachines.value.filter(m => m.status === 'locked').length
)

const getStatusTagType = (status) => {
  const typeMap = {
    'maintenance': 'danger',    // 優先級1: 維修
    'locked': 'warning',        // 優先級2: 鎖定
    'in_use': 'primary',        // 優先級3: 使用中
    'available': 'success'      // 優先級4: 可用
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    'maintenance': '維修中',
    'locked': '鎖定中', 
    'in_use': '使用中',
    'available': '可用',
    'pending': '待確認',
    'confirmed': '已確認',
    'in_progress': '進行中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return textMap[status] || status
}

const getProgress = (machine) => {
  if (!machine.start_time || !machine.end_time) return 0
  
  const start = new Date(machine.start_time)
  const end = new Date(machine.end_time)
  const now = new Date()
  
  const total = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()
  
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

const getProgressColor = (machine) => {
  const progress = getProgress(machine)
  if (progress < 50) return '#67c23a'
  if (progress < 80) return '#e6a23c'
  return '#f56c6c'
}

// 根據選中區域獲取對應的位置列表
const availableLocations = computed(() => {
  return machineStore.getLocationsByRegion(filters.value.region)
})

const applyFilters = () => {
  // 當區域改變時，清空位置篩選
  // 篩選邏輯已在 computed 中實現
}

// 當區域改變時重置位置篩選
const onRegionChange = () => {
  filters.value.location = ''
  applyFilters()
}

const clearFilters = () => {
  filters.value = {
    region: '',
    location: '',
    machine_type: '',
    status: ''
  }
}

const refreshMachines = async () => {
  try {
    await machineStore.fetchMachines()
    ElMessage.success('洗衣機狀態已更新')
  } catch (error) {
    ElMessage.error('重新整理失敗')
  }
}

const bookMachine = (machine) => {
  router.push({
    path: '/booking',
    query: { machineId: machine.id }
  })
}

const viewBookingDetails = (machine) => {
  router.push('/my-bookings')
}

const viewTodayBookings = async (machine) => {
  try {
    selectedMachine.value = machine
    const response = await api.get(`/machine/${machine.id}/today-bookings`)
    todayBookings.value = response.data.bookings
    showBookingsDialog.value = true
  } catch (error) {
    ElMessage.error('獲取預約資料失敗')
  }
}

onMounted(async () => {
  try {
    if (machineStore.machines.length === 0) {
      await machineStore.fetchMachines()
    }
    // 不再需要單獨獲取 locations，因為它們會從機器資料中動態提取
  } catch (error) {
    // 如果沒有硬體控制器在線，顯示適當的訊息
    if (machineStore.machines.length === 0) {
      ElMessage.info('目前沒有硬體控制器在線，無法顯示洗衣機')
    }
  }
})
</script>

<style scoped>
.machines-page {
  max-width: 1200px;
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

.filter-card {
  margin-bottom: 24px;
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 150px;
}

.filter-group label {
  font-weight: 500;
  color: #666;
  white-space: nowrap;
  min-width: 60px;
}

.filter-group .el-select {
  min-width: 150px;
}

.status-summary {
  display: flex;
  gap: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.summary-item .label {
  color: #666;
  font-size: 14px;
}

.summary-item .value {
  font-weight: 600;
  font-size: 16px;
}

.summary-item.available .value {
  color: #52c41a;
}

.summary-item.occupied .value {
  color: #fa8c16;
}

.summary-item.locked .value {
  color: #faad14;
}

.summary-item.maintenance .value {
  color: #ff4d4f;
}

.machines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.machine-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.machine-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.machine-card.available {
  border-color: #52c41a;
}

.machine-card.in_use {
  border-color: #fa8c16;
}

.machine-card.locked {
  border-color: #faad14;
}

.machine-card.maintenance {
  border-color: #ff4d4f;
}

.machine-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.machine-title h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #2c3e50;
}

.machine-type {
  color: #1890ff;
}

.machine-info {
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #666;
  font-size: 14px;
}

.time-info .time-left {
  color: #fa8c16;
  font-weight: 500;
}

.time-info .time-up {
  color: #ff4d4f;
  font-weight: 500;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.5; }
}

.user-info {
  background: #f0f9ff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #bae6fd;
}

.machine-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.progress-section {
  margin-top: 12px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-bookings {
  text-align: center;
  padding: 40px 0;
}

.bookings-timeline {
  max-height: 400px;
  overflow-y: auto;
}

.booking-timeline-item {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.booking-timeline-item:last-child {
  border-bottom: none;
}

.timeline-time {
  width: 120px;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.timeline-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.booking-user {
  font-weight: 500;
  color: #2c3e50;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .filters {
    flex-direction: column;
    gap: 12px;
  }

  .filter-group {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-summary {
    flex-direction: column;
    gap: 8px;
  }

  .machines-grid {
    grid-template-columns: 1fr;
  }

  .machine-actions {
    flex-direction: column;
  }
}
</style>
