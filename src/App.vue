<template>
  <div id="app">
    <header v-if="!isSessionRoute" class="app-header">
      <h1><i class="fas fa-video"></i> Live Sessions</h1>
    </header>

    <main class="app-main" :class="{ 'full-height': isSessionRoute }">
      <router-view />
    </main>
  </div>
</template>

<script>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

export default {
  name: 'App',
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.app-header h1 {
  margin: 0;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-main {
  flex: 1;
  min-height: calc(100vh - 80px);
  background: #f8f9fa;
}

.app-main.full-height {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}
</style>
