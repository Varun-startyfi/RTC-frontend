<template>
  <div class="home">
    <div class="hero-section">
      <h2>Welcome to Live Sessions</h2>
      <p>Create instant video sessions and connect with others in real-time</p>

      <div class="action-section">
        <div class="create-session-card">
          <h3><i class="fas fa-plus-circle"></i> Create New Session</h3>
          <form @submit.prevent="createSession" class="session-form">
            <div class="form-group">
              <label for="userName">Your Name</label>
              <input
                id="userName"
                v-model="userName"
                type="text"
                placeholder="Enter your name"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="sessionName">Session Name <span class="optional">(Optional)</span></label>
              <input
                id="sessionName"
                v-model="sessionName"
                type="text"
                placeholder="Enter session name (e.g., Team Meeting, Project Discussion)"
                class="form-input"
                maxlength="100"
              />
            </div>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <i class="fas fa-video"></i>
              {{ loading ? 'Creating...' : 'Start Session' }}
            </button>
          </form>
        </div>

        <div class="join-session-card">
          <h3><i class="fas fa-sign-in-alt"></i> Join Existing Session</h3>
          <form @submit.prevent="joinSession" class="session-form">
            <div class="form-group">
              <label for="joinUserName">Your Name</label>
              <input
                id="joinUserName"
                v-model="joinUserName"
                type="text"
                placeholder="Enter your name"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="sessionId">Session ID</label>
              <input
                id="sessionId"
                v-model="sessionId"
                type="text"
                placeholder="Enter session ID"
                required
                class="form-input"
              />
            </div>
            <button type="submit" class="btn btn-secondary" :disabled="loading">
              <i class="fas fa-users"></i>
              {{ loading ? 'Joining...' : 'Join Session' }}
            </button>
          </form>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
    </div>

    <!-- Public Link Modal -->
    <div v-if="showLinkModal" class="modal-overlay" @click.self="closeLinkModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-link"></i> Session Created!</h3>
          <button @click="closeLinkModal" class="modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-description">
            Share this link with others to let them join your session:
          </p>
          <div class="link-container">
            <input
              :value="publicLink"
              readonly
              class="link-input"
              ref="linkInput"
            />
            <button @click="copyLink" class="btn btn-copy" :class="{ copied: linkCopied }">
              <i :class="linkCopied ? 'fas fa-check' : 'fas fa-copy'"></i>
              {{ linkCopied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <div class="modal-actions">
            <button @click="goToSession" class="btn btn-primary btn-large">
              <i class="fas fa-video"></i> Go to Session
            </button>
            <button @click="closeLinkModal" class="btn btn-secondary">
              Stay Here
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import sessionService from '../services/sessionService'

export default {
  name: 'Home',
  setup() {
    const router = useRouter()
    const userName = ref('')
    const sessionName = ref('')
    const joinUserName = ref('')
    const sessionId = ref('')
    const loading = ref(false)
    const error = ref('')
    const showLinkModal = ref(false)
    const publicLink = ref('')
    const linkCopied = ref(false)
    const createdSessionData = ref(null)
    const linkInput = ref(null)

    const createSession = async () => {
      if (!userName.value.trim()) return

      loading.value = true
      error.value = ''

      try {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const response = await sessionService.createSession({
          userId,
          userName: userName.value.trim(),
          sessionName: sessionName.value.trim() || null
        })

        createdSessionData.value = response
        publicLink.value = `${window.location.origin}/join/${response.sessionId}`
        
        // Debug: Log the response to check for RTM token
        console.log('Session created - full response:', response)
        console.log('RTM token present:', !!response.rtmToken)
        
        // Store sessionData in sessionStorage as backup
        sessionStorage.setItem(`session_${response.sessionId}`, JSON.stringify(response))
        
        showLinkModal.value = true
        linkCopied.value = false
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to create session'
      } finally {
        loading.value = false
      }
    }

    const copyLink = async () => {
      try {
        if (linkInput.value) {
          linkInput.value.select()
          linkInput.value.setSelectionRange(0, 99999) // For mobile devices
          await navigator.clipboard.writeText(publicLink.value)
          linkCopied.value = true
          setTimeout(() => {
            linkCopied.value = false
          }, 2000)
        }
      } catch (err) {
        console.error('Failed to copy link:', err)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = publicLink.value
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        linkCopied.value = true
        setTimeout(() => {
          linkCopied.value = false
        }, 2000)
      }
    }

    const goToSession = () => {
      if (createdSessionData.value) {
        // Ensure it's in sessionStorage
        sessionStorage.setItem(`session_${createdSessionData.value.sessionId}`, JSON.stringify(createdSessionData.value))
        
        router.push({
          path: `/session/${createdSessionData.value.sessionId}`,
          state: { sessionData: createdSessionData.value }
        })
      }
      closeLinkModal()
    }

    const closeLinkModal = () => {
      showLinkModal.value = false
    }

    const joinSession = async () => {
      if (!joinUserName.value.trim() || !sessionId.value.trim()) return

      loading.value = true
      error.value = ''

      try {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const sessionData = await sessionService.joinSession(sessionId.value.trim(), {
          userId,
          userName: joinUserName.value.trim()
        })

        console.log('Joining session, navigating with data:', sessionData)
        
        // Store sessionData in sessionStorage as backup
        sessionStorage.setItem(`session_${sessionId.value.trim()}`, JSON.stringify(sessionData))
        
        router.push({
          path: `/session/${sessionId.value.trim()}`,
          state: { sessionData }
        })
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to join session'
      } finally {
        loading.value = false
      }
    }

    return {
      userName,
      sessionName,
      joinUserName,
      sessionId,
      loading,
      error,
      showLinkModal,
      publicLink,
      linkCopied,
      linkInput,
      createSession,
      joinSession,
      copyLink,
      goToSession,
      closeLinkModal
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-section h2 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 1rem;
}

.hero-section p {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
}

.action-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.create-session-card,
.join-session-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
}

.create-session-card h3,
.join-session-card h3 {
  color: #333;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.form-group label .optional {
  font-weight: 400;
  font-size: 0.85rem;
  color: #888;
  font-style: italic;
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

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-2px);
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #f5c6cb;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #666;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #f8f9fa;
  color: #333;
}

.modal-body {
  padding: 2rem;
}

.modal-description {
  color: #666;
  margin-bottom: 1.5rem;
  text-align: center;
}

.link-container {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.link-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: monospace;
  background: #f8f9fa;
  color: #333;
}

.btn-copy {
  background: #6c757d;
  color: white;
  padding: 0.75rem 1.5rem;
  white-space: nowrap;
}

.btn-copy:hover:not(:disabled) {
  background: #5a6268;
}

.btn-copy.copied {
  background: #28a745;
}

.btn-copy.copied:hover {
  background: #218838;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

@media (max-width: 768px) {
  .action-section {
    grid-template-columns: 1fr;
  }

  .hero-section h2 {
    font-size: 2rem;
  }

  .modal-content {
    margin: 1rem;
  }

  .modal-header,
  .modal-body {
    padding: 1.5rem;
  }

  .link-container {
    flex-direction: column;
  }

  .modal-actions {
    flex-direction: column;
  }
}
</style>
