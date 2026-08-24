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
    path: '/superadmin/crear-bar',
    name: 'superadmin-create-venue',
    component: () => import('../views/SuperAdminCreateVenue.vue'),
    meta: { requiresSuperAdmin: true },
  },
  {
    path: '/superadmin/venue/:venueId',
    component: () => import('../views/SuperAdminVenueDetail.vue'),
    meta: { requiresSuperAdmin: true },
    children: [
      {
        path: '',
        name: 'superadmin-venue',
        component: () => import('../views/venue/SuperAdminVenueOverview.vue'),
      },
      {
        path: 'configuracion',
        name: 'superadmin-venue-config',
        component: () => import('../views/venue/SuperAdminVenueConfig.vue'),
      },
      {
        path: 'usuarios',
        name: 'superadmin-venue-users',
        component: () => import('../views/venue/SuperAdminVenueUsers.vue'),
      },
    ],
  },
  {
    path: '/superadmin/admins',
    name: 'superadmin-admins',
    component: () => import('../views/SuperAdminUsers.vue'),
    meta: { requiresSuperAdmin: true },
  },
  {
    path: '/superadmin/users',
    redirect: '/superadmin/admins',
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
    path: '/admin/signup',
    name: 'admin-signup',
    component: () => import('../views/AdminSignup.vue'),
  },
  {
    path: '/admin/verify-email',
    name: 'admin-verify-email',
    component: () => import('../views/VerifyEmail.vue'),
  },
  {
    path: '/admin/forgot-password',
    name: 'admin-forgot-password',
    component: () => import('../views/ForgotPassword.vue'),
  },
  {
    path: '/admin/reset-password',
    name: 'admin-reset-password',
    component: () => import('../views/ResetPassword.vue'),
  },
  {
    path: '/admin/onboarding',
    name: 'admin-onboarding',
    component: () => import('../views/AdminOnboarding.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/privacidad',
    name: 'privacy-policy',
    component: () => import('../views/PrivacyPolicy.vue'),
  },
  {
    path: '/politica-privacidad',
    redirect: '/privacidad',
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
    const needsOnboarding = auth.adminInfo?.onboarding_completed_at == null
    if (needsOnboarding && to.name !== 'admin-onboarding') {
      next({ name: 'admin-onboarding' })
      return
    }
    if (!needsOnboarding && to.name === 'admin-onboarding') {
      next({ name: 'admin', params: { venueSlug: auth.adminInfo?.venue_slug } })
      return
    }
  }

  next()
})

export default router
