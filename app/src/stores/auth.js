import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token'))
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  const login = async (studentId, name = '', dormNumber = '', bedNumber = '') => {
    loading.value = true
    try {
      const requestData = {
        student_id: studentId
      }
      
      // 只有在提供了姓名時才加入其他字段（新用戶註冊）
      if (name) {
        requestData.name = name
        if (dormNumber) requestData.dorm_number = dormNumber
        if (bedNumber) requestData.bed_number = bedNumber
      }
      
      const response = await api.post('/auth/login', requestData)

      token.value = response.data.token
      user.value = response.data.user

      localStorage.setItem('token', token.value)
      localStorage.setItem('user', JSON.stringify(user.value))

      // 設置API默認headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`

      return response.data
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
  }

  const updateProfile = async (profileData) => {
    try {
      await api.put('/auth/profile', profileData)
      
      // 重新獲取用戶信息
      const response = await api.get('/auth/profile')
      user.value = response.data.user
      localStorage.setItem('user', JSON.stringify(user.value))
      
      return response.data
    } catch (error) {
      throw error
    }
  }

  const initializeAuth = async () => {
    if (token.value) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      try {
        const response = await api.get('/auth/verify')
        user.value = response.data.user
        localStorage.setItem('user', JSON.stringify(user.value))
      } catch (error) {
        // Token無效，清除認證信息
        logout()
      }
    }
  }

  return {
    token,
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    initializeAuth
  }
})
