import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

// 只導入需要的圖標
import {
  User, Lock, HomeFilled, Monitor, Plus, List, CreditCard, 
  Bell, Refresh, ArrowDown, SwitchButton, Fold, Expand,
  Setting, Avatar, Message, Phone, Timer, Calendar,
  Location, Clock, Money, AlarmClock, Grid, ChatLineSquare,
  Key, Connection
} from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// 註冊需要的圖標
const icons = {
  User, Lock, HomeFilled, Monitor, Plus, List, CreditCard,
  Bell, Refresh, ArrowDown, SwitchButton, Fold, Expand,
  Setting, Avatar, Message, Phone, Timer, Calendar,
  Location, Clock, Money, AlarmClock, Grid, ChatLineSquare,
  Key, Connection
}

for (const [key, component] of Object.entries(icons)) {
  app.component(key, component)
}

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')

// 在掛載後初始化認證狀態
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.initializeAuth()
