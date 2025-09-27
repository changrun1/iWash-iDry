<template>
  <div class="login-container">
    <div class="login-wrapper">
      <div class="login-header">
        <div class="logo">
          <img class="brand-logo" :src="brandLogo" alt="iWash-iDry" />
        </div>
        <h1 class="title">iWash-iDry</h1>
        <p class="subtitle">校園智慧洗衣／烘衣預約服務</p>
      </div>

      <el-card class="login-card">
        <template #header>
          <div class="card-header">
            <span>{{ isNewUser ? '註冊帳號' : '登入系統' }}</span>
            <el-button 
              type="text" 
              @click="toggleMode"
              class="toggle-btn"
            >
              {{ isNewUser ? '返回登入' : '新用戶註冊' }}
            </el-button>
          </div>
        </template>

        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          label-width="80px"
          size="large"
        >
          <el-form-item label="學號" prop="student_id">
            <el-input
              v-model="loginForm.student_id"
              placeholder="請輸入學號"
              prefix-icon="User"
              clearable
              @blur="checkUser"
            />
          </el-form-item>

          <transition name="fade">
            <div v-if="isNewUser">
              <el-form-item label="姓名" prop="name">
                <el-input
                  v-model="loginForm.name"
                  placeholder="請輸入真實姓名"
                  prefix-icon="Avatar"
                  clearable
                />
              </el-form-item>

              <el-form-item label="宿舍號碼" prop="dorm_number">
                <el-input
                  v-model="loginForm.dorm_number"
                  placeholder="請輸入宿舍名稱（如：誠軒、樸軒）"
                  prefix-icon="House"
                  clearable
                />
              </el-form-item>

              <el-form-item label="床位號碼" prop="bed_number">
                <el-input
                  v-model="loginForm.bed_number"
                  placeholder="請輸入床位號碼（如：101A）"
                  prefix-icon="Grid"
                  clearable
                />
              </el-form-item>
            </div>
          </transition>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="authStore.loading"
              @click="handleLogin"
              style="width: 100%"
            >
              {{ isNewUser ? '註冊並登入' : '登入' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-tips">
          <el-alert
            title="提示"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              <p>• 首次使用請輸入學號、姓名、宿舍和床位資訊註冊</p>
              <p>• 每週可預約洗衣機2次、烘衣機2次</p>
              <p>• 支援LINE通知服務</p>
            </template>
          </el-alert>
        </div>
      </el-card>

      <div class="login-footer">
        <p>&copy; 2024 iWash-iDry. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import brandLogo from '@/assets/logo.png'

const router = useRouter()
const authStore = useAuthStore()

const loginFormRef = ref()
const isNewUser = ref(false)

const loginForm = reactive({
  student_id: '',
  name: '',
  dorm_number: '',
  bed_number: ''
})

const loginRules = computed(() => ({
  student_id: [
    { required: true, message: '請輸入學號', trigger: 'blur' },
    { min: 5, message: '學號至少5位數', trigger: 'blur' }
  ],
  name: isNewUser.value ? [
    { required: true, message: '請輸入姓名', trigger: 'blur' },
    { min: 2, message: '姓名至少2個字', trigger: 'blur' }
  ] : [],
  dorm_number: isNewUser.value ? [
    { required: true, message: '請輸入宿舍號碼', trigger: 'blur' }
  ] : [],
  bed_number: isNewUser.value ? [
    { required: true, message: '請輸入床位號碼', trigger: 'blur' }
  ] : []
}))

// 切換登入/註冊模式
const toggleMode = () => {
  isNewUser.value = !isNewUser.value
  // 清空表單驗證錯誤
  if (loginFormRef.value) {
    loginFormRef.value.clearValidate()
  }
}

// 檢查用戶是否存在
const checkUser = async () => {
  if (!loginForm.student_id || loginForm.student_id.length < 5) {
    return
  }

  try {
    // 只檢查用戶是否存在，不自動登入
    const response = await api.get(`/auth/check-user/${loginForm.student_id}`)
    
    if (response.data.exists) {
      isNewUser.value = false
      ElMessage.info('歡迎回來！')
    } else {
      isNewUser.value = true
      ElMessage.info('檢測到新用戶，請填寫個人資料')
    }
  } catch (error) {
    // 如果API不存在，暫時不做任何操作
    console.log('check-user API不可用，將在登錄時檢查')
  }
}

const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()
    
    // 如果是新用戶模式但沒有填寫必要資料
    if (isNewUser.value && (!loginForm.name || !loginForm.dorm_number || !loginForm.bed_number)) {
      ElMessage.warning('請填寫完整的個人資料')
      return
    }
    
    // 根據是否為新用戶決定傳送的參數
    if (isNewUser.value) {
      // 新用戶註冊
      await authStore.login(
        loginForm.student_id,
        loginForm.name,
        loginForm.dorm_number,
        loginForm.bed_number
      )
    } else {
      // 現有用戶登入，只傳送學號
      await authStore.login(loginForm.student_id)
    }

    ElMessage.success(isNewUser.value ? '註冊成功！' : '登入成功！')
    router.push('/dashboard')
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('姓名')) {
      isNewUser.value = true
      ElMessage.info('首次登入需要填寫個人資料')
    } else {
      ElMessage.error(error.response?.data?.message || '操作失敗')
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-wrapper {
  width: 100%;
  max-width: 480px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  margin-bottom: 20px;
}

.logo .el-icon {
  color: #2c3e50;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.brand-logo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #2c3e50;
  text-shadow: none;
  position: relative;
}

.subtitle {
  color: #5a6c7d;
  font-size: 16px;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.toggle-btn {
  color: #1890ff;
  font-size: 14px;
  padding: 0;
}

.login-tips {
  margin-top: 20px;
}

.login-tips .el-alert {
  background: #f8f9fa;
  border: none;
}

.login-footer {
  text-align: center;
  margin-top: 30px;
  color: #5a6c7d;
  font-size: 14px;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 768px) {
  .login-container {
    padding: 10px;
  }
  
  .title {
    font-size: 24px;
  }
  
  .login-card {
    margin: 0;
  }
}
</style>
