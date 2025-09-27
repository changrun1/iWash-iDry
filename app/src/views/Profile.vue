<template>
  <div class="profile-page">
    <div class="page-header">
      <h2>個人資料</h2>
      <el-button type="primary" @click="saveProfile" :loading="saving">
        儲存變更
      </el-button>
    </div>

    <div class="profile-content">
      <!-- 基本資料 -->
      <el-card class="profile-card">
        <template #header>
          <div class="card-header">
            <span>基本資料</span>
            <el-button type="text" @click="toggleEdit('basic')">
              {{ editMode.basic ? '取消' : '編輯' }}
            </el-button>
          </div>
        </template>

        <el-form 
          ref="profileFormRef"
          :model="profileForm"
          :rules="profileRules"
          label-width="100px"
        >
          <el-form-item label="學號">
            <el-input v-model="profileForm.student_id" disabled />
          </el-form-item>

          <el-form-item label="姓名" prop="name">
            <el-input 
              v-model="profileForm.name" 
              :disabled="!editMode.basic"
              placeholder="請輸入真實姓名"
            />
          </el-form-item>

          <el-form-item label="宿舍號碼" prop="dorm_number">
            <el-input 
              v-model="profileForm.dorm_number" 
              :disabled="!editMode.basic"
              placeholder="請輸入宿舍名稱（如：誠軒、樸軒）"
            />
          </el-form-item>

          <el-form-item label="床位號碼" prop="bed_number">
            <el-input 
              v-model="profileForm.bed_number" 
              :disabled="!editMode.basic"
              placeholder="請輸入床位號碼（如：101A）"
            />
          </el-form-item>

          <el-form-item label="註冊時間">
            <el-input v-model="registrationDate" disabled />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 使用統計 -->
      <el-card class="stats-card">
        <template #header>
          <span>使用統計</span>
        </template>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number">{{ userStats.totalBookings }}</div>
            <div class="stat-label">總預約次數</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{{ userStats.completedBookings }}</div>
            <div class="stat-label">完成次數</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{{ userStats.weeklyWashing }}</div>
            <div class="stat-label">本週洗衣</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{{ userStats.weeklyDrying }}</div>
            <div class="stat-label">本週烘衣</div>
          </div>
        </div>
      </el-card>

      <!-- 通知設定 -->
      <el-card class="notification-card">
        <template #header>
          <span>通知設定</span>
        </template>

        <div class="notification-settings">
          <el-form-item>
            <div class="setting-item">
              <div class="setting-info">
                <h4>LINE 通知</h4>
                <p>洗衣完成後透過 LINE 通知</p>
              </div>
              <el-switch 
                v-model="notificationSettings.lineNotification"
                @change="updateNotificationSetting('lineNotification')"
              />
            </div>
          </el-form-item>

          <el-form-item>
            <div class="setting-item">
              <div class="setting-info">
                <h4>簡訊通知</h4>
                <p>洗衣完成後透過簡訊通知</p>
              </div>
              <el-switch 
                v-model="notificationSettings.smsNotification"
                @change="updateNotificationSetting('smsNotification')"
              />
            </div>
          </el-form-item>

          <el-form-item>
            <div class="setting-item">
              <div class="setting-info">
                <h4>預約提醒</h4>
                <p>預約開始前 15 分鐘提醒</p>
              </div>
              <el-switch 
                v-model="notificationSettings.bookingReminder"
                @change="updateNotificationSetting('bookingReminder')"
              />
            </div>
          </el-form-item>
        </div>
      </el-card>

      <!-- 安全設定 -->
      <el-card class="security-card">
        <template #header>
          <span>安全設定</span>
        </template>

        <div class="security-actions">
          <el-button 
            type="warning" 
            @click="showPasswordDialog = true"
            icon="Lock"
          >
            修改密碼
          </el-button>
          
          <el-button 
            type="danger" 
            @click="confirmDeleteAccount"
            icon="Delete"
          >
            刪除帳戶
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 修改密碼對話框 -->
    <el-dialog
      v-model="showPasswordDialog"
      title="修改密碼"
      width="400px"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="新密碼" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            placeholder="請輸入新密碼"
          />
        </el-form-item>

        <el-form-item label="確認密碼" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="請再次輸入新密碼"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="changePassword" :loading="changingPassword">
          確認修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/date'
import api from '@/utils/api'

const authStore = useAuthStore()

const profileFormRef = ref()
const passwordFormRef = ref()
const saving = ref(false)
const changingPassword = ref(false)
const showPasswordDialog = ref(false)

const editMode = ref({
  basic: false
})

const profileForm = reactive({
  student_id: '',
  name: '',
  dorm_number: '',
  bed_number: ''
})

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

const notificationSettings = ref({
  lineNotification: true,
  smsNotification: false,
  bookingReminder: true
})

const userStats = ref({
  totalBookings: 0,
  completedBookings: 0,
  weeklyWashing: 0,
  weeklyDrying: 0
})

const registrationDate = computed(() => {
  return authStore.user?.created_at ? formatDateTime(authStore.user.created_at) : ''
})

const profileRules = {
  name: [
    { required: true, message: '請輸入姓名', trigger: 'blur' },
    { min: 2, message: '姓名至少2個字', trigger: 'blur' }
  ],
  dorm_number: [
    { required: true, message: '請輸入宿舍號碼', trigger: 'blur' }
  ],
  bed_number: [
    { required: true, message: '請輸入床位號碼', trigger: 'blur' }
  ]
}

const passwordRules = {
  newPassword: [
    { required: true, message: '請輸入新密碼', trigger: 'blur' },
    { min: 6, message: '密碼至少6位數', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '請確認密碼', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('兩次輸入的密碼不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const toggleEdit = (section) => {
  editMode.value[section] = !editMode.value[section]
  if (!editMode.value[section]) {
    // 取消編輯時恢復原始數據
    loadUserProfile()
  }
}

const loadUserProfile = async () => {
  try {
    const response = await api.get('/auth/me')
    const userData = response.data.user
    
    profileForm.student_id = userData.student_id
    profileForm.name = userData.name
    profileForm.dorm_number = userData.dorm_number || ''
    profileForm.bed_number = userData.bed_number || ''
    
    // 載入通知設定
    notificationSettings.value = {
      lineNotification: userData.line_notification !== false,
      smsNotification: userData.sms_notification === true,
      bookingReminder: userData.booking_reminder !== false
    }
  } catch (error) {
    ElMessage.error('載入個人資料失敗')
  }
}

const loadUserStats = async () => {
  try {
    const response = await api.get('/auth/stats')
    userStats.value = response.data.stats
  } catch (error) {
    console.error('載入統計數據失敗:', error)
  }
}

const saveProfile = async () => {
  if (!profileFormRef.value) return

  try {
    await profileFormRef.value.validate()
    
    saving.value = true
    await api.put('/auth/profile', {
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone
    })

    // 更新 store 中的用戶資料
    authStore.user = {
      ...authStore.user,
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone
    }

    editMode.value.basic = false
    ElMessage.success('個人資料已更新')
  } catch (error) {
    ElMessage.error('更新失敗')
  } finally {
    saving.value = false
  }
}

const updateNotificationSetting = async (setting) => {
  try {
    await api.put('/auth/notification-settings', {
      [setting]: notificationSettings.value[setting]
    })
    ElMessage.success('通知設定已更新')
  } catch (error) {
    ElMessage.error('設定更新失敗')
    // 恢復原始狀態
    notificationSettings.value[setting] = !notificationSettings.value[setting]
  }
}

const changePassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate()
    
    changingPassword.value = true
    await api.put('/auth/change-password', {
      newPassword: passwordForm.newPassword
    })

    showPasswordDialog.value = false
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    ElMessage.success('密碼已修改')
  } catch (error) {
    ElMessage.error('修改密碼失敗')
  } finally {
    changingPassword.value = false
  }
}

const confirmDeleteAccount = async () => {
  try {
    await ElMessageBox.confirm(
      '刪除帳戶後將無法恢復，確定要刪除嗎？',
      '確認刪除',
      {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    await api.delete('/auth/account')
    ElMessage.success('帳戶已刪除')
    authStore.logout()
    this.$router.push('/login')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('刪除帳戶失敗')
    }
  }
}

onMounted(() => {
  loadUserProfile()
  loadUserStats()
})
</script>

<style scoped>
.profile-page {
  max-width: 800px;
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

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-card,
.stats-card,
.notification-card,
.security-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #2c3e50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.notification-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.setting-info h4 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 16px;
}

.setting-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.security-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .security-actions {
    flex-direction: column;
  }
}
</style>
