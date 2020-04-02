import Vue from 'vue'
import createRouter from './createRouter'
import App from './App.vue'

Vue.config.productionTip = false

// Export factory function
export default function createApp (ctx) {
  // 1. Create a router instance
  const router = createRouter()

  // 2. Create root component option
  const app = {
    router,
    head: {},
    render: h => h(App)
  }

  // 3. return
  return app
}
