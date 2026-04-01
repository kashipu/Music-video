import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  // Super Admin
  {
    path: '/superadmin/login',
    name: 'superadmin-login',
    component: () => import('../views/SuperAdminLogin.vue'),
  },
  {
    path: '/superadmin',
    name: 'superadmin',
    component: () => import('../views/SuperAdminPanel.vue'),
    meta: { requiresSuperAdmin: true },
  },
  {
    path: '/superadmin/venue/:venueId',
    name: 'superadmin-venue',
    component: () => import('../views/SuperAdminVenueDetail.vue'),
    meta: { requiresSuperAdmin: true },
  },

  // Venue routes (dynamic slug)
  {
    path: '/:venueSlug/registro',
    name: 'registro',
    component: () => import('../views/QRLanding.vue'),
  },
  {
    path: '/:venueSlug/usuario',
    name: 'usuario',
    component: () => import('../views/CustomerDashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'admin-login-global',
    component: () => import('../views/AdminLogin.vue'),
  },
  {
    path: '/:venueSlug/admin/login',
    name: 'admin-login',
    component: () => import('../views/AdminLogin.vue'),
  },
  {
    path: '/:venueSlug/admin',
    name: 'admin',
    component: () => import('../views/AdminDashboard.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/:venueSlug/video',
    name: 'video',
    component: () => import('../views/Kiosk.vue'),
    meta: { requiresAdmin: true },
  },

  // Root — no redirect, blank or landing
  {
    path: '/',
    name: 'home',
    component: () => import('../views/AdminLogin.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  const venueSlug = to.params.venueSlug

  if (to.meta.requiresSuperAdmin) {
    if (!localStorage.getItem('bq_super_token')) {
      next({ name: 'superadmin-login' })
      return
    }
  }

  if (to.meta.requiresAuth && !auth.token) {
    next({ name: 'registro', params: { venueSlug } })
    return
  }

  if (to.meta.requiresAdmin) {
    if (!auth.adminToken) {
      if (venueSlug) {
        next({ name: 'admin-login', params: { venueSlug } })
      } else {
        next({ name: 'admin-login-global' })
      }
      return
    }
    // Verify admin token matches this venue
    if (venueSlug && auth.adminInfo?.venue_slug && auth.adminInfo.venue_slug !== venueSlug) {
      auth.adminLogout()
      next({ name: 'admin-login', params: { venueSlug } })
      return
    }
  }

  next()
})

export default router
