<template>
  <div class="booking-page">
    <div class="page-header">
      <h2>立即預約</h2>
      <div class="weekly-limit">
        <el-tag :type="weeklyWashing >= 2 ? 'danger' : 'success'" class="limit-tag">
          本週洗衣 {{ weeklyWashing }}/2 次
        </el-tag>
        <el-tag :type="weeklyDrying >= 2 ? 'danger' : 'success'" class="limit-tag">
          本週烘衣 {{ weeklyDrying }}/2 次
        </el-tag>
      </div>
    </div>

    <!-- 步驟指示器 -->
    <el-steps :active="currentStep" align-center class="booking-steps">
      <el-step title="選擇洗衣機" icon="Monitor" />
      <el-step title="選擇時間" icon="Clock" />
      <el-step title="確認預約" icon="Check" />
    </el-steps>

    <div class="booking-content">
      <!-- 步驟1: 選擇洗衣機 -->
      <el-card v-if="currentStep === 0" class="step-card">
        <template #header>
          <h3>選擇洗衣機</h3>
        </template>

        <!-- 篩選器 -->
        <div class="filters">
          <el-select 
            v-model="filters.region" 
            placeholder="選擇區域" 
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

          <el-select 
            v-model="filters.location" 
            placeholder="選擇位置" 
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

          <el-select 
            v-model="filters.machine_type" 
            placeholder="選擇類型" 
            clearable 
            @change="applyFilters"
            style="min-width: 120px;"
          >
            <el-option label="全部類型" value="" />
            <el-option label="洗衣機" value="washing" />
            <el-option label="烘衣機" value="drying" />
          </el-select>

          <el-button @click="refreshMachines" :loading="machineStore.loading">
            <el-icon><Refresh /></el-icon>
            重新整理
          </el-button>
        </div>

        <!-- 洗衣機選擇 -->
        <div class="machines-grid">
          <div
            v-for="machine in availableMachines"
            :key="machine.id"
            class="machine-option"
            :class="{ active: selectedMachine?.id === machine.id }"
            @click="selectMachine(machine)"
          >
            <div class="machine-header">
              <h4>{{ machine.machine_code }}</h4>
              <el-tag :type="machine.machine_type === 'washing' ? 'primary' : 'warning'" size="small">
                {{ machine.machine_type === 'washing' ? '洗衣機' : '烘衣機' }}
              </el-tag>
            </div>
            <div class="machine-details">
              <p><el-icon><Location /></el-icon>{{ machine.location }}</p>
              <p class="price">費用: {{ machine.machine_type === 'washing' ? '30' : '20' }} 元</p>
            </div>
            <div class="machine-status">
              <el-tag type="success" size="small">可用</el-tag>
            </div>
          </div>
        </div>

        <div v-if="availableMachines.length === 0" class="empty-state">
          <el-empty description="暫無可用的洗衣機">
            <el-button @click="refreshMachines">重新整理</el-button>
          </el-empty>
        </div>

        <div class="step-actions">
          <el-button type="primary" @click="nextStep" :disabled="!selectedMachine">
            下一步
          </el-button>
        </div>
      </el-card>

      <!-- 步驟2: 選擇時間 -->
      <el-card v-if="currentStep === 1" class="step-card">
        <template #header>
          <h3>選擇時間</h3>
        </template>

        <div class="time-selection">
          <div class="selected-machine-info">
            <h4>已選擇: {{ selectedMachine?.machine_code }} - {{ selectedMachine?.location }}</h4>
          </div>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="預約日期">
                <el-date-picker
                  v-model="bookingForm.date"
                  type="date"
                  placeholder="選擇日期"
                  :disabled-date="disabledDate"
                  style="width: 100%"
                  @change="loadAvailableSlots"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="使用時長">
                <el-select v-model="bookingForm.duration" placeholder="選擇時長" style="width: 100%">
                  <el-option label="30分鐘" :value="30" />
                  <el-option label="60分鐘" :value="60" />
                  <el-option label="90分鐘" :value="90" />
                  <el-option label="120分鐘" :value="120" />
                  <el-option label="150分鐘" :value="150" />
                  <el-option label="180分鐘" :value="180" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="開始時間">
            <div class="time-slots">
              <div
                v-for="slot in availableSlots"
                :key="slot.start_time"
                class="time-slot"
                :class="{ active: selectedTimeSlot === slot.start_time }"
                @click="selectTimeSlot(slot.start_time)"
              >
                {{ formatTime(slot.start_time) }}
              </div>
            </div>
          </el-form-item>

          <div v-if="availableSlots.length === 0 && bookingForm.date" class="no-slots">
            <el-alert title="該日期暫無可用時段" type="warning" :closable="false" />
          </div>
        </div>

        <div class="step-actions">
          <el-button @click="prevStep">上一步</el-button>
          <el-button type="primary" @click="nextStep" :disabled="!selectedTimeSlot">
            下一步
          </el-button>
        </div>
      </el-card>

      <!-- 步驟3: 確認預約 -->
      <el-card v-if="currentStep === 2" class="step-card">
        <template #header>
          <h3>確認預約</h3>
        </template>

        <div class="booking-summary">
          <el-descriptions title="預約詳情" :column="1" border>
            <el-descriptions-item label="洗衣機">
              {{ selectedMachine?.machine_code }} ({{ selectedMachine?.machine_type === 'washing' ? '洗衣機' : '烘衣機' }})
            </el-descriptions-item>
            <el-descriptions-item label="位置">
              {{ selectedMachine?.location }}
            </el-descriptions-item>
            <el-descriptions-item label="預約日期">
              {{ formatDate(bookingForm.date) }}
            </el-descriptions-item>
            <el-descriptions-item label="使用時間">
              {{ formatTime(selectedTimeSlot) }} - {{ formatTime(calculateEndTime()) }}
            </el-descriptions-item>
            <el-descriptions-item label="使用時長">
              {{ bookingForm.duration }} 分鐘
            </el-descriptions-item>
            <el-descriptions-item label="費用">
              <span class="price">{{ selectedMachine?.machine_type === 'washing' ? '30' : '20' }} 元</span>
            </el-descriptions-item>
          </el-descriptions>

          <div class="booking-notes">
            <el-alert title="預約須知" type="info" :closable="false">
              <ul>
                <li>請在預約時間準時到達</li>
                <li>開始使用前30分鐘可免費取消</li>
                <li>洗衣完成將透過LINE通知</li>
                <li>每週最多可預約洗衣機2次、烘衣機2次</li>
              </ul>
            </el-alert>
          </div>
        </div>

        <div class="step-actions">
          <el-button @click="prevStep">上一步</el-button>
          <el-button type="primary" @click="confirmBooking" :loading="bookingLoading">
            確認預約
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMachineStore } from '@/stores/machine'
import { formatDate, formatTime, formatDateTime, addMinutes } from '@/utils/date'
import api from '@/utils/api'

const router = useRouter()
const machineStore = useMachineStore()

const currentStep = ref(0)
const selectedMachine = ref(null)
const selectedTimeSlot = ref('')
const weeklyWashing = ref(0)
const weeklyDrying = ref(0)
const availableSlots = ref([])
const bookingLoading = ref(false)

const filters = ref({
  region: '',
  location: '',
  machine_type: ''
})

const bookingForm = ref({
  date: '',
  duration: 60
})

const availableMachines = computed(() => {
  let machines = machineStore.machines.filter(m => m.status === 'available')

  if (filters.value.region) {
    machines = machines.filter(m => m.region === filters.value.region)
  }

  if (filters.value.location) {
    machines = machines.filter(m => m.location === filters.value.location)
  }

  if (filters.value.machine_type) {
    machines = machines.filter(m => m.machine_type === filters.value.machine_type)
  }

  return machines
})

// 根據選中區域獲取對應的位置列表
const availableLocations = computed(() => {
  return machineStore.getLocationsByRegion(filters.value.region)
})

const disabledDate = (time) => {
  // 禁用過去的日期和超過一週後的日期
  const today = new Date()
  const maxDate = new Date()
  maxDate.setDate(today.getDate() + 7)
  
  return time.getTime() < today.setHours(0,0,0,0) || time.getTime() > maxDate.getTime()
}

const selectMachine = (machine) => {
  // 檢查是否達到週預約限制
  if (machine.machine_type === 'washer' && weeklyWashing.value >= 2) {
    ElMessage.warning('本週洗衣機預約次數已達上限（2次）')
    return
  }
  
  if (machine.machine_type === 'dryer' && weeklyDrying.value >= 2) {
    ElMessage.warning('本週烘衣機預約次數已達上限（2次）')
    return
  }
  
  selectedMachine.value = machine
}

const selectTimeSlot = (timeSlot) => {
  selectedTimeSlot.value = timeSlot
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

const applyFilters = () => {
  // 篩選邏輯已在 computed 中實現
}

// 當區域改變時重置位置篩選
const onRegionChange = () => {
  filters.value.location = ''
  applyFilters()
}

const refreshMachines = async () => {
  try {
    await machineStore.fetchMachines()
    ElMessage.success('洗衣機狀態已更新')
  } catch (error) {
    ElMessage.error('重新整理失敗')
  }
}

const loadAvailableSlots = async () => {
  if (!selectedMachine.value || !bookingForm.value.date) return

  try {
    const response = await api.get('/booking/available-slots', {
      params: {
        machine_id: selectedMachine.value.id,
        date: formatDate(bookingForm.value.date)
      }
    })
    availableSlots.value = response.data.available_slots
  } catch (error) {
    ElMessage.error('獲取可用時段失敗')
  }
}

const calculateEndTime = () => {
  if (!selectedTimeSlot.value || !bookingForm.value.duration) return ''
  
  const startTime = new Date(selectedTimeSlot.value)
  return addMinutes(startTime, bookingForm.value.duration)
}

const confirmBooking = async () => {
  bookingLoading.value = true
  
  try {
    const response = await api.post('/booking/create', {
      machine_id: selectedMachine.value.id,
      booking_date: formatDate(bookingForm.value.date),
      start_time: selectedTimeSlot.value,
      duration: bookingForm.value.duration
    })

    ElMessage.success('預約成功！')
    router.push('/my-bookings')
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '預約失敗')
  } finally {
    bookingLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    machineStore.fetchMachines(),
    machineStore.fetchLocations(),
    loadWeeklyBookings()
  ])
  
  // 如果有查詢參數指定的洗衣機，自動選擇
  const machineId = router.currentRoute.value.query.machineId
  if (machineId) {
    selectedMachine.value = machineStore.getMachineById(parseInt(machineId))
    if (selectedMachine.value && selectedMachine.value.status === 'available') {
      currentStep.value = 1
    }
  }
})

const loadWeeklyBookings = async () => {
  try {
    const response = await api.get('/booking/weekly-limits')
    weeklyWashing.value = response.data.washing_count
    weeklyDrying.value = response.data.drying_count
  } catch (error) {
    console.error('獲取週預約次數失敗:', error)
    // 如果獲取失敗，設置為0
    weeklyWashing.value = 0
    weeklyDrying.value = 0
  }
}
</script>

<style scoped>
.booking-page {
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

.weekly-limit {
  display: flex;
  gap: 8px;
}

.limit-tag {
  font-size: 12px;
}

.booking-steps {
  margin-bottom: 30px;
}

.step-card {
  margin-bottom: 20px;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.filters .el-select {
  min-width: 150px;
}

.machines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.machine-option {
  padding: 16px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.machine-option:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
}

.machine-option.active {
  border-color: #1890ff;
  background: #f0f9ff;
}

.machine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.machine-header h4 {
  margin: 0;
  color: #2c3e50;
}

.machine-details p {
  margin: 8px 0;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
}

.price {
  font-weight: 600;
  color: #1890ff;
}

.machine-status {
  margin-top: 12px;
}

.time-selection {
  max-width: 600px;
}

.selected-machine-info {
  background: #f0f9ff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.selected-machine-info h4 {
  margin: 0;
  color: #1890ff;
}

.time-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.time-slot {
  padding: 8px 12px;
  text-align: center;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.time-slot:hover {
  border-color: #1890ff;
  background: #f0f9ff;
}

.time-slot.active {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.no-slots {
  margin: 20px 0;
}

.booking-summary {
  max-width: 600px;
}

.booking-notes {
  margin-top: 20px;
}

.booking-notes ul {
  margin: 8px 0 0 20px;
  padding: 0;
}

.booking-notes li {
  margin: 4px 0;
}

.step-actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .filters {
    flex-direction: column;
  }

  .machines-grid {
    grid-template-columns: 1fr;
  }

  .time-slots {
    grid-template-columns: repeat(4, 1fr);
  }

  .step-actions {
    flex-direction: column;
  }
}
</style>
