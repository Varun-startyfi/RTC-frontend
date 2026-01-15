<template>
  <div class="join-session">
    <div class="join-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading session...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Unable to Join Session</h2>
        <p>{{ error }}</p>
        <button @click="$router.push('/')" class="btn btn-primary">
          <i class="fas fa-home"></i> Go Home
        </button>
      </div>

      <div v-else-if="sessionInfo" class="join-form">
        <div class="session-header">
          <h2>
            <i class="fas fa-video"></i>
            {{ sessionInfo.name || 'Join Session' }}
          </h2>
          <div class="session-details">
            <p v-if="sessionInfo.name" class="session-name">
              <i class="fas fa-hashtag"></i>
              Session ID: <strong>{{ sessionId }}</strong>
            </p>
            <p class="session-creator">
              <i class="fas fa-user"></i>
              Created by: <strong>{{ sessionInfo.creatorName }}</strong>
            </p>
            <p class="session-participants">
              <i class="fas fa-users"></i>
              {{ sessionInfo.participants?.length || 0 }} participant{{ (sessionInfo.participants?.length || 0) !== 1 ? 's' : '' }}
            </p>
          </div>
        </div>

        <form @submit.prevent="joinSession" class="join-form-content">
          <div class="form-group">
            <label for="userName">
              <i class="fas fa-user-circle"></i> Your Name
            </label>
            <input
              id="userName"
              v-model="userName"
              type="text"
              placeholder="Enter your name"
              required
              class="form-input"
              :disabled="joining"
            />
          </div>

          <button type="submit" class="btn btn-primary btn-large" :disabled="joining || !userName.trim()">
            <i class="fas fa-sign-in-alt"></i>
            {{ joining ? 'Joining...' : 'Join Session' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import sessionService from '../services/sessionService'

export default {
  name: 'JoinSession',
  setup() {
    const route = useRoute()
    const router = useRouter()

    const sessionId = ref(route.params.id)
    const userName = ref('')
    const sessionInfo = ref(null)
    const loading = ref(true)
    const joining = ref(false)
    const error = ref('')

    const loadSessionInfo = async () => {
      try {
        loading.value = true
        error.value = ''

        const info = await sessionService.getSession(sessionId.value)
        
        if (info.status === 'ended') {
          error.value = 'This session has ended.'
          return
        }

        if (info.status !== 'active') {
          error.value = 'This session is not active.'
          return
        }

        sessionInfo.value = info
      } catch (err) {
        console.error('Error loading session:', err)
        if (err.response?.status === 404) {
          error.value = 'Session not found. Please check the link and try again.'
        } else {
          error.value = err.response?.data?.error || 'Failed to load session information.'
        }
      } finally {
        loading.value = false
      }
    }

    const joinSession = async () => {
      if (!userName.value.trim()) return

      joining.value = true
      error.value = ''

      try {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const sessionData = await sessionService.joinSession(sessionId.value, {
          userId,
          userName: userName.value.trim()
        })

        console.log('Joining session, navigating with data:', sessionData)
        
        // Store sessionData in sessionStorage as backup
        sessionStorage.setItem(`session_${sessionId.value}`, JSON.stringify(sessionData))
        
        router.push({
          path: `/prepare/${sessionId.value}`,
          state: { sessionData }
        })
      } catch (err) {
        console.error('Error joining session:', err)
        error.value = err.response?.data?.error || 'Failed to join session. Please try again.'
        joining.value = false
      }
    }

    onMounted(() => {
      loadSessionInfo()
    })

    return {
      sessionId,
      userName,
      sessionInfo,
      loading,
      joining,
      error,
      joinSession
    }
  }
}
</script>

<style scoped>
.join-session {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-sizing: border-box;
}

.join-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;
  padding: 2.5rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 2rem;
}

.loading-state .spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state i {
  font-size: 3rem;
  color: #dc3545;
  margin-bottom: 1rem;
}

.error-state h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.error-state p {
  color: #666;
  margin-bottom: 1.5rem;
}

.join-form {
  width: 100%;
}

.session-header {
  text-align: center;
  margin-bottom: 2rem;
}

.session-header h2 {
  color: #333;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.session-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.session-details p {
  margin: 0;
  color: #555;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.session-details strong {
  color: #333;
}

.join-form-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  text-align: left;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
}

.form-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .join-session {
    padding: 1rem;
  }

  .join-container {
    padding: 1.5rem;
  }

  .session-details {
    flex-direction: column;
  }
}
</style>
