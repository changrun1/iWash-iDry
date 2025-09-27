import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
    // 移除 User-Agent，瀏覽器不允許設定此標頭
  }
})

// 請求攔截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 響應攔截器
api.interceptors.response.use(
  response => {
    return response
  },
  error => {
    const { response } = error

    if (response?.status === 401) {
      // 未授權，清除本地存儲並跳轉到登錄頁
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      ElMessage.error('登錄已過期，請重新登錄')
    } else if (response?.status === 403) {
      ElMessage.error('沒有權限執行此操作')
    } else if (response?.status === 404) {
      ElMessage.error('請求的資源不存在')
    } else if (response?.status >= 500) {
      ElMessage.error('服務器錯誤，請稍後再試')
    } else if (response?.data?.message) {
      ElMessage.error(response.data.message)
    } else {
      ElMessage.error('請求失敗，請檢查網絡連接')
    }

    return Promise.reject(error)
  }
)

export default api
