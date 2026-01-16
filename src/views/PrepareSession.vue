<template>
  <div class="prepare-session">
    <div class="prepare-container">
      <div class="prepare-header">
        <h2><i class="fas fa-video"></i> Prepare Your Session</h2>
        <p class="subtitle">Test your camera and microphone before joining</p>
      </div>

      <div class="preview-section">
        <div class="video-preview-container">
          <div v-if="!videoEnabled" class="video-placeholder">
            <i class="fas fa-video-slash"></i>
            <p>Camera is off</p>
          </div>
          <video
            ref="previewVideo"
            autoplay
            playsinline
            muted
            class="preview-video"
            :class="{ hidden: !videoEnabled }"
          ></video>
          <div v-if="videoEnabled" class="preview-overlay">
            <span class="preview-label">{{ userName || 'You' }}</span>
          </div>
        </div>

        <div class="audio-indicator">
          <div class="audio-label">
            <i class="fas fa-microphone"></i>
            <span>Microphone</span>
          </div>
          <div class="audio-level-bar">
            <div
              class="audio-level-fill"
              :style="{ width: `${audioLevel}%` }"
              :class="{ active: audioEnabled && audioLevel > 0 }"
            ></div>
          </div>
          <span v-if="audioLevel === 0 && audioEnabled" class="audio-hint">Speak to test your microphone</span>
        </div>
      </div>

      <div class="controls-section">
        <div class="device-controls">
          <button
            @click="toggleVideo"
            class="device-btn"
            :class="{ muted: !videoEnabled, active: videoEnabled }"
            title="Toggle Camera"
          >
            <i :class="videoEnabled ? 'fas fa-video' : 'fas fa-video-slash'"></i>
            <span>{{ videoEnabled ? 'Camera On' : 'Camera Off' }}</span>
          </button>

          <button
            @click="toggleAudio"
            class="device-btn"
            :class="{ muted: !audioEnabled, active: audioEnabled }"
            title="Toggle Microphone"
          >
            <i :class="audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash'"></i>
            <span>{{ audioEnabled ? 'Microphone On' : 'Microphone Off' }}</span>
          </button>

          <div class="device-selector">
            <select
              v-model="selectedCamera"
              @change="changeCamera"
              class="device-select"
              title="Select Camera"
            >
              <option value="">Select Camera...</option>
              <option
                v-for="camera in cameras"
                :key="camera.deviceId"
                :value="camera.deviceId"
              >
                {{ camera.label || `Camera ${cameras.indexOf(camera) + 1}` }}
              </option>
            </select>

            <select
              v-model="selectedMicrophone"
              @change="changeMicrophone"
              class="device-select"
              title="Select Microphone"
            >
              <option value="">Select Microphone...</option>
              <option
                v-for="mic in microphones"
                :key="mic.deviceId"
                :value="mic.deviceId"
              >
                {{ mic.label || `Microphone ${microphones.indexOf(mic) + 1}` }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="session-info">
        <div v-if="isHost" class="info-item host-badge">
          <i class="fas fa-crown"></i>
          <span>You are the <strong>Host</strong> of this session</span>
        </div>
        <div v-if="sessionName" class="info-item">
          <i class="fas fa-heading"></i>
          <span><strong>{{ sessionName }}</strong></span>
        </div>
        <div class="info-item">
          <i class="fas fa-hashtag"></i>
          <span>Session ID: <strong>{{ sessionId.substring(0, 8) }}...</strong></span>
        </div>
        <div class="info-item">
          <i class="fas fa-user"></i>
          <span>Your name: <strong>{{ userName }}</strong></span>
        </div>
      </div>

      <div class="action-buttons">
        <button @click="goBack" class="btn btn-secondary">
          <i class="fas fa-arrow-left"></i>
          Go Back
        </button>
        <button @click="joinSession" class="btn btn-primary" :disabled="joining">
          <i :class="joining ? 'fas fa-spinner fa-spin' : 'fas fa-sign-in-alt'"></i>
          {{ joining ? 'Joining...' : 'Join Session' }}
        </button>
      </div>

      <div v-if="error" class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../composables/useToast'

export default {
  name: 'PrepareSession',
  setup() {
    const route = useRoute()
    const router = useRouter()

    const previewVideo = ref(null)
    const videoEnabled = ref(true)
    const audioEnabled = ref(true)
    const audioLevel = ref(0)
    const cameras = ref([])
    const microphones = ref([])
    const selectedCamera = ref('')
    const selectedMicrophone = ref('')
    const ready = ref(false)
    const joining = ref(false)
    const error = ref('')
    const { showToast } = useToast()

    const sessionId = ref(route.params.sessionId || route.params.id)
    const sessionData = route.state?.sessionData || JSON.parse(sessionStorage.getItem(`session_${sessionId.value}`) || 'null')
    const userName = ref(sessionData?.userName || sessionData?.creatorName || 'User')
    const sessionName = ref(sessionData?.name || sessionData?.sessionName || null)
    const isHost = computed(() => {
      return sessionData?.role === 'host' || sessionData?.createdBy === sessionData?.userId
    })

    watch(
      () => error.value,
      (value) => {
        if (value) {
          showToast(value, 'error')
        }
      }
    )

    let localTracks = ref([])
    let audioContext = null
    let analyser = null
    let microphone = null
    let dataArray = null
    let animationFrameId = null

    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        cameras.value = devices.filter(d => d.kind === 'videoinput')
        microphones.value = devices.filter(d => d.kind === 'audioinput')

        // Set default selections
        if (cameras.value.length > 0 && !selectedCamera.value) {
          selectedCamera.value = cameras.value[0].deviceId
        }
        if (microphones.value.length > 0 && !selectedMicrophone.value) {
          selectedMicrophone.value = microphones.value[0].deviceId
        }

        ready.value = true
      } catch (err) {
        console.error('Error loading devices:', err)
        error.value = 'Failed to load devices. Please check permissions.'
      }
    }

    const startPreview = async () => {
      try {
        // Stop existing tracks
        await stopPreview()

        if (!videoEnabled.value && !audioEnabled.value) {
          ready.value = true
          return
        }

        const constraints = {
          video: videoEnabled.value
            ? selectedCamera.value
              ? { deviceId: { exact: selectedCamera.value } }
              : true
            : false,
          audio: audioEnabled.value
            ? selectedMicrophone.value
              ? { deviceId: { exact: selectedMicrophone.value } }
              : true
            : false
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        localTracks.value = stream.getTracks()

        // Setup video preview
        if (videoEnabled.value && previewVideo.value) {
          previewVideo.value.srcObject = stream
          await previewVideo.value.play()
        }

        // Setup audio level monitoring
        if (audioEnabled.value) {
          setupAudioLevelMonitoring(stream)
        }

        ready.value = true
      } catch (err) {
        console.error('Error starting preview:', err)
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          error.value = 'Camera/microphone access denied. Please allow access and refresh.'
        } else if (err.name === 'NotFoundError') {
          error.value = 'Camera or microphone not found. Please check your devices.'
        } else {
          error.value = 'Failed to access camera/microphone. Please try again.'
        }
        ready.value = false
      }
    }

    const setupAudioLevelMonitoring = (stream) => {
      try {
        // Cleanup previous monitoring
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }
        if (audioContext) {
          audioContext.close()
        }

        audioContext = new (window.AudioContext || window.webkitAudioContext)()
        analyser = audioContext.createAnalyser()
        microphone = audioContext.createMediaStreamSource(stream)
        microphone.connect(analyser)

        analyser.fftSize = 256
        const bufferLength = analyser.frequencyBinCount
        dataArray = new Uint8Array(bufferLength)

        const updateAudioLevel = () => {
          if (!audioEnabled.value || !analyser) {
            audioLevel.value = 0
            return
          }

          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength
          audioLevel.value = Math.min(100, (average / 255) * 100)

          animationFrameId = requestAnimationFrame(updateAudioLevel)
        }

        updateAudioLevel()
      } catch (err) {
        console.error('Error setting up audio monitoring:', err)
      }
    }

    const stopPreview = async () => {
      // Stop audio monitoring
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      if (audioContext) {
        await audioContext.close()
        audioContext = null
      }
      analyser = null
      microphone = null
      dataArray = null

      // Stop tracks
      localTracks.value.forEach(track => {
        track.stop()
      })
      localTracks.value = []

      // Clear video preview
      if (previewVideo.value) {
        previewVideo.value.srcObject = null
      }
    }

    const toggleVideo = async () => {
      videoEnabled.value = !videoEnabled.value
      await startPreview()
    }

    const toggleAudio = async () => {
      audioEnabled.value = !audioEnabled.value
      await startPreview()
    }

    const changeCamera = async () => {
      if (videoEnabled.value) {
        await startPreview()
      }
    }

    const changeMicrophone = async () => {
      if (audioEnabled.value) {
        await startPreview()
      }
    }

    const joinSession = async () => {
      if (joining.value) return

      joining.value = true
      error.value = ''

      try {
        // Get current tracks for use in session
        const videoTrack = localTracks.value.find(t => t.kind === 'video')
        const audioTrack = localTracks.value.find(t => t.kind === 'audio')

        // Stop preview but don't stop tracks yet - we'll pass them to Session
        // Note: We can't actually pass MediaStreamTracks through router state easily
        // So we'll stop them here and Session will create new ones
        // But we save the device preferences

        // Save device preferences to sessionStorage
        if (selectedCamera.value) {
          sessionStorage.setItem('preferredCamera', selectedCamera.value)
        }
        if (selectedMicrophone.value) {
          sessionStorage.setItem('preferredMicrophone', selectedMicrophone.value)
        }
        sessionStorage.setItem('preferredVideoEnabled', videoEnabled.value.toString())
        sessionStorage.setItem('preferredAudioEnabled', audioEnabled.value.toString())

        await stopPreview()

        // Navigate to session
        router.push({
          path: `/session/${sessionId.value}`,
          state: { sessionData }
        })
      } catch (err) {
        console.error('Error joining session:', err)
        error.value = 'Failed to join session. Please try again.'
        joining.value = false
      }
    }

    const goBack = async () => {
      await stopPreview()
      router.back()
    }

    onMounted(async () => {
      try {
        await loadDevices()
        await startPreview()
      } catch (err) {
        console.error('Error initializing preview:', err)
        error.value = 'Failed to initialize. Please check your camera and microphone permissions.'
      }
    })

    onUnmounted(async () => {
      await stopPreview()
    })

    return {
      previewVideo,
      videoEnabled,
      audioEnabled,
      audioLevel,
      cameras,
      microphones,
      selectedCamera,
      selectedMicrophone,
      ready,
      joining,
      error,
      sessionId,
      sessionName,
      userName,
      isHost,
      toggleVideo,
      toggleAudio,
      changeCamera,
      changeMicrophone,
      joinSession,
      goBack
    }
  }
}
</script>

<style scoped>
.prepare-session {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem;
  background: var(--gradient-hero);
}

.prepare-container {
  background: var(--color-surface-glass);
  backdrop-filter: blur(18px);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 960px;
  width: 100%;
  padding: 2.75rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.prepare-header {
  text-align: center;
  margin-bottom: 2rem;
}

.prepare-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.prepare-header h2 i {
  color: #667eea;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 1rem;
}

.preview-section {
  margin-bottom: 2rem;
}

.video-preview-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-md);
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-video.hidden {
  display: none;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  color: rgba(255, 255, 255, 0.5);
}

.video-placeholder i {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.video-placeholder p {
  margin: 0;
  font-size: 1.1rem;
}

.preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  padding: 1rem;
}

.preview-label {
  color: white;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.audio-indicator {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.audio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  font-weight: 600;
}

.audio-label i {
  color: #667eea;
}

.audio-level-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.audio-level-fill {
  height: 100%;
  background: #e0e0e0;
  transition: width 0.1s ease, background 0.3s ease;
  border-radius: 4px;
}

.audio-level-fill.active {
  background: linear-gradient(90deg, #4caf50 0%, #8bc34a 50%, #ffc107 80%, #ff5722 100%);
}

.audio-hint {
  font-size: 0.85rem;
  color: #999;
  font-style: italic;
}

.controls-section {
  margin-bottom: 2rem;
}

.device-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.device-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.device-btn:hover {
  border-color: rgba(91, 124, 250, 0.5);
  background: #f5f7ff;
}

.device-btn.active {
  border-color: rgba(34, 197, 94, 0.6);
  background: rgba(34, 197, 94, 0.08);
  color: #166534;
}

.device-btn.muted {
  border-color: rgba(239, 68, 68, 0.6);
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
}

.device-btn i {
  font-size: 1.2rem;
}

.device-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.device-select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--color-text);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-select:focus {
  outline: none;
  border-color: rgba(91, 124, 250, 0.7);
  box-shadow: 0 0 0 3px rgba(91, 124, 250, 0.2);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-md);
  margin-bottom: 2rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

.info-item i {
  color: #667eea;
  width: 20px;
}

.info-item strong {
  color: var(--color-text);
}

.info-item.host-badge {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%);
  border: 2px solid rgba(255, 193, 7, 0.3);
  padding: 1rem;
  border-radius: 8px;
  color: #f57c00;
  font-weight: 600;
}

.info-item.host-badge i {
  color: #ffc107;
  font-size: 1.2rem;
}

.info-item.host-badge strong {
  color: #e65100;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #1f2937;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #111827;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(17, 24, 39, 0.3);
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(91, 124, 250, 0.4);
}

.error-message {
  margin-top: 1.5rem;
  padding: 1rem 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: var(--radius-sm);
  color: #b91c1c;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.error-message i {
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .prepare-container {
    padding: 1.5rem;
  }

  .prepare-header h2 {
    font-size: 1.5rem;
  }

  .device-selector {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

