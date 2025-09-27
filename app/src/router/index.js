import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: '/machines',
        name: 'Machines',
        component: () => import('@/views/Machines.vue')
      },
      {
        path: '/booking',
        name: 'Booking',
        component: () => import('@/views/Booking.vue')
      },
      {
        path: '/my-bookings',
        name: 'MyBookings',
        component: () => import('@/views/MyBookings.vue')
      },
      {
        path: '/payment',
        name: 'Payment',
        component: () => import('@/views/Payment.vue')
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue')
      },
      {
        path: '/line-binding',
        name: 'LineBinding',
        component: () => import('@/views/LineBinding.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
