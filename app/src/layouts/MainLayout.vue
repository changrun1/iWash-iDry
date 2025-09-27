<template>
  <div class="layout-container">
    <el-container>
      <!-- 側邊欄 -->
      <el-aside class="sidebar" :class="{ 'is-collapsed': isCollapsed }">
        <div class="sidebar-header">
          <div class="logo">
            <img class="brand-logo" :src="brandLogo" alt="iWash-iDry" />
            <span class="logo-text">iWash-iDry</span>
          </div>
          <el-button
            type="text"
            @click="toggleSidebar"
            class="collapse-btn"
          >
            <el-icon><Fold v-if="!isCollapsed" /><Expand v-else /></el-icon>
          </el-button>
        </div>

        <el-menu
          :default-active="$route.path"
          router
          :collapse="isCollapsed"
          :collapse-transition="false"
          class="sidebar-menu"
          background-color="#001529"
          text-color="rgba(255, 255, 255, 0.85)"
          active-text-color="#ffffff"
        >
          <el-menu-item index="/dashboard">
            <el-icon><HomeFilled /></el-icon>
            <template #title>首頁</template>
          </el-menu-item>
          
          <el-menu-item index="/machines">
            <el-icon><Monitor /></el-icon>
            <template #title>洗衣機狀態</template>
          </el-menu-item>
          
          <el-menu-item index="/booking">
            <el-icon><Plus /></el-icon>
            <template #title>立即預約</template>
          </el-menu-item>
          
          <el-menu-item index="/my-bookings">
            <el-icon><List /></el-icon>
            <template #title>我的預約</template>
          </el-menu-item>
          
          <el-menu-item index="/payment">
            <el-icon><CreditCard /></el-icon>
            <template #title>付款記錄</template>
          </el-menu-item>
          
          <el-menu-item index="/line-binding">
            <el-icon><ChatLineSquare /></el-icon>
            <template #title>LINE 綁定</template>
          </el-menu-item>
          
          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <template #title>個人資料</template>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主要內容區域 -->
      <el-container direction="vertical">
        <!-- 頂部導航 -->
        <el-header class="header">
          <div class="header-left">
            <Breadcrumb />
          </div>
          
          <div class="header-right">
            <el-button
              type="text"
              @click="refreshData"
              :loading="refreshing"
              class="refresh-btn"
            >
              <el-icon><Refresh /></el-icon>
              重新整理
            </el-button>

            <el-dropdown @command="handleUserAction">
              <div class="user-avatar">
                <el-avatar :size="32">
                  {{ authStore.user?.name?.charAt(0) || 'U' }}
                </el-avatar>
                <span class="username">{{ authStore.user?.name }}</span>
                <el-icon><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">
                    <el-icon><User /></el-icon>
                    個人設定
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    登出
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <!-- 主要內容區域 -->
        <el-main class="main-content">
          <router-view />
        </el-main>

        <!-- 底部 -->
        <el-footer class="footer">
          <div class="footer-content">
            <span>&copy; 2024 iWash-iDry</span>
            <div class="footer-links">
              <el-link type="primary" href="#" :underline="false">使用說明</el-link>
              <el-link type="primary" href="#" :underline="false">聯絡我們</el-link>
              <el-link type="primary" href="#" :underline="false">意見回饋</el-link>
            </div>
          </div>
        </el-footer>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useMachineStore } from '@/stores/machine'
import Breadcrumb from '@/components/Breadcrumb.vue'
import brandLogo from '@/assets/logo.png'

const router = useRouter()
const authStore = useAuthStore()
const machineStore = useMachineStore()

const isCollapsed = ref(false)
const refreshing = ref(false)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const refreshData = async () => {
  refreshing.value = true
  try {
    await machineStore.fetchMachines()
    ElMessage.success('數據已更新')
  } catch (error) {
    ElMessage.error('更新失敗')
  } finally {
    refreshing.value = false
  }
}

const handleUserAction = async (command) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm(
          '確定要登出嗎？',
          '確認登出',
          {
            confirmButtonText: '確定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        authStore.logout()
        ElMessage.success('已登出')
        router.push('/login')
      } catch {
        // 用戶取消登出
      }
      break
  }
}

onMounted(() => {
  // 初始化數據
  machineStore.fetchMachines()
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
  background-color: #f5f5f5;
}

.sidebar {
  background-color: #001529;
  transition: width 0.3s ease;
  width: 220px;
  display: flex;
  flex-direction: column;
}

.sidebar.is-collapsed {
  width: 64px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 64px;
  flex-shrink: 0;
  border-bottom: 1px solid #263445;
}

.sidebar.is-collapsed .sidebar-header {
  justify-content: center;
  padding: 0 8px;
}

.sidebar.is-collapsed .logo {
  display: none;
}

.sidebar.is-collapsed .collapse-btn {
  margin-left: 0;
}

.logo {
  display: flex;
  align-items: center;
  color: white;
  font-size: 18px;
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
}

.brand-logo {
  width: 28px;
  height: 28px;
  margin-right: 10px;
  border-radius: 50%;
}

.logo-text {
  transition: opacity 0.3s ease, width 0.3s ease;
  overflow: hidden;
}

.collapse-btn-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-btn {
  color: rgba(255, 255, 255, 0.7);
  font-size: 22px;
  transition: margin-left 0.3s ease;
  background: none !important;
  border: none !important;
  padding: 4px;
}

.collapse-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1) !important;
}

.header {
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0,21,41,.08);
  z-index: 1;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  color: #1890ff;
}

.user-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-avatar:hover {
  background-color: #f5f5f5;
}

.username {
  font-size: 14px;
  color: #333;
}

.main-content {
  padding: 24px;
  background-color: #f5f5f5;
  min-height: calc(100vh - 140px);
  overflow-y: auto;
}

.footer {
  background-color: white;
  border-top: 1px solid #e8e8e8;
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  color: #666;
  font-size: 14px;
}

.footer-links {
  display: flex;
  gap: 16px;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    z-index: 1000;
    height: 100vh;
  }

  .main-content {
    margin-left: 0;
    padding: 16px;
  }

  .username {
    display: none;
  }

  .footer-content {
    flex-direction: column;
    gap: 8px;
  }

  .footer-links {
    gap: 12px;
  }
}

/* 確保菜單項目樣式與側邊欄背景匹配 */
.sidebar-menu {
  border-right: none;
  flex: 1;
}

.sidebar-menu .el-menu-item {
  border-right: none !important;
}

.sidebar-menu .el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: #1890ff !important;
  border-right: none !important;
  color: #ffffff !important;
}

.sidebar-menu .el-menu-item.is-active:hover {
  background-color: #40a9ff !important;
  color: #ffffff !important;
}
</style>
