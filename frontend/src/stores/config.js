import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = import.meta.env.VITE_API_URL || ''

export const useConfigStore = defineStore('config', () => {
  const google_signup = ref(true)
  const pagos = ref(true)

  async function load() {
    try {
      const res = await fetch(`${API}/api/config`)
      if (!res.ok) return
      const config = await res.json()
      google_signup.value = config.google_signup !== false
      pagos.value = config.pagos !== false
    } catch { /* Fail open: a temporary network error must not hide features. */ }
  }

  return { google_signup, pagos, load }
})
