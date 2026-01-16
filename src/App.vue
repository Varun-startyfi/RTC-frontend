<template>
  <div id="app">
    <header v-if="!isSessionRoute" class="app-header">
      <h1><i class="fas fa-video"></i> Live Sessions</h1>
    </header>

    <main class="app-main" :class="{ 'full-height': isSessionRoute }">
      <router-view />
    </main>

    <ToastContainer />
  </div>
</template>

<script>
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import ToastContainer from './components/ToastContainer.vue'

export default {
  name: 'App',
  components: {
    ToastContainer
  },
  setup() {
    const route = useRoute()
    const isSessionRoute = computed(() => {
      return route.name === 'Session' || route.name === 'JoinSession'
    })
    
    return {
      isSessionRoute
    }
  }
}
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

.app-header {
  background: var(--gradient-primary);
  color: white;
  padding: 1.25rem 2.5rem;
  box-shadow: var(--shadow-sm);
}

.app-header h1 {
  margin: 0;
  font-size: 1.85rem;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  letter-spacing: 0.2px;
}

.app-main {
  flex: 1;
  min-height: calc(100vh - 80px);
  background: var(--color-surface-muted);
}

.app-main.full-height {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}
</style>
