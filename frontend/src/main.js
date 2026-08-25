import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { useConfigStore } from './stores/config.js'
import './style.css'
// El orden importa: los temas por bar deben poder ganarle al tema por defecto.
import './themes/default.css'
import './themes/craft.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
useConfigStore(pinia).load()
app.mount('#app')

const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('splash-hidden')
  setTimeout(() => splash.remove(), 300)
}
