<template>
  <el-breadcrumb separator="/">
    <el-breadcrumb-item
      v-for="item in breadcrumbList"
      :key="item.path"
      :to="item.path"
    >
      <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const routeMap = {
  '/dashboard': { title: '首頁', icon: 'HomeFilled' },
  '/machines': { title: '洗衣機狀態', icon: 'Monitor' },
  '/booking': { title: '立即預約', icon: 'Plus' },
  '/my-bookings': { title: '我的預約', icon: 'List' },
  '/payment': { title: '付款記錄', icon: 'CreditCard' },
  '/notifications': { title: '通知中心', icon: 'Bell' },
  '/profile': { title: '個人設定', icon: 'User' }
}

const breadcrumbList = computed(() => {
  const matched = route.matched.filter(item => item.path !== '')
  const breadcrumbs = []

  matched.forEach((item, index) => {
    const routeInfo = routeMap[item.path]
    if (routeInfo) {
      breadcrumbs.push({
        path: index === matched.length - 1 ? '' : item.path,
        title: routeInfo.title,
        icon: routeInfo.icon
      })
    }
  })

  return breadcrumbs
})
</script>

<style scoped>
.el-breadcrumb {
  font-size: 14px;
}

.el-icon {
  margin-right: 4px;
}
</style>
