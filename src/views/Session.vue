<template>
  <div class="session">
    <!-- Minimal floating info (only on hover or when needed) -->
    <div class="session-info-float" :class="{ visible: showFloatingInfo }">
      <div class="float-info-content">
        <span class="session-title">{{ sessionName || `Session: ${sessionId.substring(0, 8)}` }}</span>
        <span class="participants-badge">
          <i class="fas fa-users"></i>
          {{ participants.length }}
        </span>
      </div>
    </div>

    <!-- Floating controls bar (bottom center) -->
    <div class="floating-controls" :class="{ 'screen-sharing': activeScreenShare }">
      <button @click="showShareModal = true" class="floating-btn share-btn" title="Share Session Link">
        <i class="fas fa-share-alt"></i>
      </button>
      <button @click="toggleChat" class="floating-btn" :class="{ active: showChat }" title="Toggle Chat">
        <i class="fas fa-comments"></i>
        <span v-if="unreadCount > 0" class="chat-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </button>
      <button @click="toggleScreenShare" class="floating-btn" :class="{ active: isScreenSharing }" title="Share Screen">
        <i :class="isScreenSharing ? 'fas fa-stop' : 'fas fa-desktop'"></i>
      </button>
      <button @click="toggleAudio" class="floating-btn" :class="{ muted: !audioEnabled }" title="Toggle Microphone">
        <i :class="audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash'"></i>
      </button>
      <button @click="toggleVideo" class="floating-btn" :class="{ muted: !videoEnabled }" title="Toggle Camera">
        <i :class="videoEnabled ? 'fas fa-video' : 'fas fa-video-slash'"></i>
      </button>
      <button @click="endSession" class="floating-btn end-btn" title="End Session">
        <i class="fas fa-phone-slash"></i>
      </button>
    </div>

    <!-- Chat Panel -->
    <div class="chat-panel" :class="{ 'chat-open': showChat }">
      <div class="chat-header">
        <h3><i class="fas fa-comments"></i> Chat</h3>
        <button @click="showChat = false" class="chat-close-btn">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="chat-messages" ref="chatMessagesRef">
        <div
          v-for="message in chatMessages"
          :key="message.id"
          class="chat-message"
          :class="{ 'own-message': message.userId === currentUser?.userId }"
        >
          <div class="message-header">
            <span class="message-sender">{{ message.userName || 'Unknown' }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-content">{{ message.text }}</div>
        </div>
        <div v-if="chatMessages.length === 0" class="chat-empty">
          <i class="fas fa-comments"></i>
          <p>No messages yet. Start the conversation!</p>
        </div>
      </div>
      <div class="chat-input-container">
        <input
          v-model="chatInput"
          @keyup.enter="sendChatMessage"
          type="text"
          placeholder="Type a message..."
          class="chat-input"
          :disabled="!rtmReady"
        />
        <button @click="sendChatMessage" class="chat-send-btn" :disabled="!chatInput.trim() || !rtmReady">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>

    <div class="video-container" :class="{ 'screen-sharing': activeScreenShare, 'single-user': participants.length === 1 }" @mouseenter="showFloatingInfo = true" @mouseleave="showFloatingInfo = false">
      <!-- Shared Screen View (large) -->
      <div v-if="activeScreenShare" class="screen-share-container">
        <div class="screen-share-main">
          <div :id="`screen-player-${activeScreenShare.uid}`" class="screen-player"></div>
          <div class="screen-share-overlay">
            <span class="screen-share-label">
              <i class="fas fa-desktop"></i>
              {{ activeScreenShare.userName }} is sharing screen
            </span>
          </div>
        </div>
      </div>

      <!-- Participants Grid (smaller when screen is shared) -->
      <div class="video-grid" :class="{ 'with-screen-share': activeScreenShare }">
        <!-- Local video -->
        <div class="video-item local-video" :class="{ 'screen-sharer': isLocalScreenSharing }">
          <div id="local-player" class="video-player"></div>
          <div class="video-overlay">
            <span class="participant-name">{{ currentUser?.userName }} (You)</span>
            <div class="video-controls">
              <button @click="toggleAudio" class="mini-control-btn" :class="{ muted: !audioEnabled }">
                <i :class="audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash'"></i>
              </button>
              <button @click="toggleVideo" class="mini-control-btn" :class="{ muted: !videoEnabled }">
                <i :class="videoEnabled ? 'fas fa-video' : 'fas fa-video-slash'"></i>
              </button>
            </div>
          </div>
          <div v-if="isLocalScreenSharing" class="screen-share-indicator">
            <i class="fas fa-desktop"></i> Sharing Screen
          </div>
        </div>

        <!-- Remote videos -->
        <div
          v-for="participant in remoteParticipants"
          :key="participant.uid"
          class="video-item remote-video"
          :class="{ 'screen-sharer': activeScreenShare && activeScreenShare.uid === participant.uid }"
        >
          <div :id="`remote-player-${participant.uid}`" class="video-player"></div>
          <div class="video-overlay">
            <span class="participant-name">{{ participant.userName || `User ${participant.uid}` }}</span>
          </div>
          <div v-if="activeScreenShare && activeScreenShare.uid === participant.uid" class="screen-share-indicator">
            <i class="fas fa-desktop"></i> Sharing Screen
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal-overlay" @click.self="showShareModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-share-alt"></i> Share Session</h3>
          <button @click="showShareModal = false" class="modal-close">
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
              ref="shareLinkInput"
            />
            <button @click="copyShareLink" class="btn btn-copy" :class="{ copied: shareLinkCopied }">
              <i :class="shareLinkCopied ? 'fas fa-check' : 'fas fa-copy'"></i>
              {{ shareLinkCopied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgoraRTC from 'agora-rtc-sdk-ng'
import AgoraRTM from 'agora-rtm-sdk'
import io from 'socket.io-client'
import sessionService from '../services/sessionService'

export default {
  name: 'Session',
  setup() {
    const route = useRoute()
    const router = useRouter()

    const sessionId = ref(route.params.id)
    const sessionName = ref(null)
    const participants = ref([])
    const currentUser = ref(null)
    const error = ref('')
    const audioEnabled = ref(true)
    const videoEnabled = ref(true)
    const isScreenSharing = ref(false)
    const activeScreenShare = ref(null) // { uid, userName }
    const showShareModal = ref(false)
    const shareLinkCopied = ref(false)
    const shareLinkInput = ref(null)
    const showFloatingInfo = ref(false)
    const showChat = ref(false)
    const chatMessages = ref([])
    const chatInput = ref('')
    const unreadCount = ref(0)
    const chatMessagesRef = ref(null)
    const rtmReady = ref(false)
    const publicLink = computed(() => `${window.location.origin}/join/${sessionId.value}`)

    let agoraClient = null
    let localTrack = null
    let screenTrack = null
    let socket = null
    let sessionData = null
    let rtmClient = null
    let rtmChannel = null

    // Try to get sessionData from router state (Vue Router 4) or sessionStorage
    const getSessionDataFromState = () => {
      // Try multiple ways to get the state
      if (router.currentRoute.value?.state?.sessionData) {
        return router.currentRoute.value.state.sessionData
      }
      if (history.state?.sessionData) {
        return history.state.sessionData
      }
      if (window.history?.state?.sessionData) {
        return window.history.state.sessionData
      }
      
      // Fallback: try to get from sessionStorage
      try {
        const stored = sessionStorage.getItem(`session_${sessionId.value}`)
        if (stored) {
          return JSON.parse(stored)
        }
      } catch (e) {
        console.error('Error reading from sessionStorage:', e)
      }
      
      return null
    }

    sessionData = getSessionDataFromState()
    console.log('Session component initialized with sessionData:', sessionData)
    
    // Clear old sessionData from sessionStorage if it doesn't have rtmToken (from before backend update)
    if (sessionData && !sessionData.rtmToken && sessionData.token) {
      console.warn('Detected old sessionData without RTM token. This session was created before the backend update.')
      console.warn('Please create a new session or clear sessionStorage and rejoin.')
      // Don't clear automatically - let user create new session
    }
    console.log('Router state:', router.currentRoute.value?.state)
    console.log('History state:', history.state)

    const remoteParticipants = computed(() => {
      // Filter participants that have published media (have UID) and are not the current user
      const currentUserId = currentUser.value?.userId || sessionData?.userId
      return participants.value.filter(p => 
        p.uid !== null && 
        p.uid !== undefined &&
        p.userId !== currentUserId
      )
    })

    const requestPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        stream.getTracks().forEach(track => track.stop())
        console.log('Camera and microphone permissions granted')
        return true
      } catch (error) {
        console.error('Permission denied:', error)
        error.value = 'Camera and microphone permissions are required for video calls. Please allow access and refresh the page.'
        return false
      }
    }

    const refreshParticipantList = async () => {
      try {
        const sessionInfo = await sessionService.getSession(sessionId.value)
        if (sessionInfo) {
          // Update session name if available
          if (sessionInfo.name) {
            sessionName.value = sessionInfo.name
          }

          if (sessionInfo.participants) {
            // Preserve existing UIDs when refreshing
            const existingUids = new Map()
            participants.value.forEach(p => {
              if (p.uid && p.userId) {
                existingUids.set(p.userId, p.uid)
              }
            })

            // Update participants list with fresh data from API, preserving UIDs
            participants.value = sessionInfo.participants.map(p => ({
              ...p,
              uid: existingUids.get(p.userId) || null // Preserve existing UID or set to null
            }))
            console.log('Participant list refreshed:', participants.value)
          }
        }
      } catch (err) {
        console.error('Error refreshing participant list:', err)
      }
    }

    const initAgoraClient = async () => {
      try {
        console.log('Starting Agora initialization...')

        // Request permissions first
        const hasPermissions = await requestPermissions()
        if (!hasPermissions) return

        // Try to get sessionData from state again (in case it wasn't available at init)
        if (!sessionData) {
          sessionData = getSessionDataFromState()
          console.log('Retried getting sessionData:', sessionData)
        }

        // If still no sessionData, try to fetch session info from API
        // But we'll need to join to get a token
        if (!sessionData) {
          console.log('No sessionData in state, fetching session info from API...')
          try {
            const sessionInfo = await sessionService.getSession(sessionId.value)
            console.log('Session info fetched:', sessionInfo)
            
            // If session exists but we don't have token data, redirect to join page
            if (sessionInfo && sessionInfo.status === 'active') {
              error.value = 'Please join this session using the join link or session ID.'
              // Optionally redirect to join page after a delay
              setTimeout(() => {
                router.push(`/join/${sessionId.value}`)
              }, 2000)
              return
            } else {
              error.value = 'Session not found or not active. Please create a new session.'
              return
            }
          } catch (apiError) {
            console.error('Error fetching session:', apiError)
            error.value = 'Session not found. Please create a new session or join with a valid session ID.'
            return
          }
        }

        participants.value = sessionData.participants || []
        currentUser.value = sessionData.participants?.find(p => p.userId === sessionData.userId) || null
        sessionName.value = sessionData.name || null

        // Refresh participant list from API to ensure we have the latest data
        await refreshParticipantList()

        // Check if Agora is available
        if (!AgoraRTC || !AgoraRTC.createClient) {
          error.value = 'Agora SDK not loaded. Please check your internet connection and refresh the page.'
          return
        }

        // Validate session data
        if (!sessionData.appId || !sessionData.token) {
          console.error('Invalid session data:', sessionData)
          error.value = 'Invalid session data. Please try creating or joining the session again.'
          return
        }

        // Initialize Agora client
        console.log('Initializing Agora client with:', {
          appId: sessionData.appId,
          sessionId: sessionId.value,
          token: sessionData.token ? 'present' : 'missing',
          userId: sessionData.userId
        })

        agoraClient = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp8'
        })

        console.log('Agora client created successfully')

        // Set up event handlers
        agoraClient.on('user-published', async (user, mediaType) => {
          console.log(`User ${user.uid} published ${mediaType}`)
          try {
            await agoraClient.subscribe(user, mediaType)
            console.log(`Subscribed to ${user.uid}'s ${mediaType}`)

            if (mediaType === 'video') {
              const remoteVideoTrack = user.videoTrack
              
              // Check if this is a screen share track
              // Screen tracks typically have "screen" in their label or have specific properties
              let isScreenTrack = false
              if (remoteVideoTrack) {
                try {
                  const mediaStreamTrack = remoteVideoTrack.getMediaStreamTrack()
                  if (mediaStreamTrack) {
                    const trackLabel = mediaStreamTrack.label?.toLowerCase() || ''
                    // Check if it's a screen capture track by label
                    isScreenTrack = trackLabel.includes('screen') ||
                                   trackLabel.includes('display') ||
                                   trackLabel.includes('window') ||
                                   (remoteVideoTrack.isScreen === true)
                    
                    // Also check: if user already has a video player element, this new video track is likely screen
                    const existingPlayer = document.getElementById(`remote-player-${user.uid}`)
                    if (existingPlayer && !isScreenTrack) {
                      console.log(`User ${user.uid} already has video, new track might be screen`)
                      // Check track properties more carefully
                      isScreenTrack = trackLabel.length > 0 && (
                        trackLabel.includes('screen') || 
                        trackLabel.includes('display')
                      )
                    }
                  }
                } catch (e) {
                  console.log('Could not determine track type, checking if user has existing video')
                  // Fallback: if user already has a video track published, this might be screen
                  const existingPlayer = document.getElementById(`remote-player-${user.uid}`)
                  if (existingPlayer) {
                    console.log(`User ${user.uid} has existing video player, assuming new track is screen`)
                    isScreenTrack = true
                  }
                }
              }
              
              if (isScreenTrack) {
                // Handle screen sharing
                console.log(`User ${user.uid} is sharing screen`)
                const participant = participants.value.find(p => p.uid === user.uid || p.userId === user.uid)
                activeScreenShare.value = {
                  uid: user.uid,
                  userName: participant?.userName || `User ${user.uid}`
                }

                // Play screen in the large screen player
                const screenPlayerId = `screen-player-${user.uid}`
                setTimeout(() => {
                  const screenPlayerElement = document.getElementById(screenPlayerId)
                  if (screenPlayerElement) {
                    remoteVideoTrack.play(screenPlayerId)
                    console.log(`Playing screen share for user ${user.uid}`)
                  } else {
                    console.warn(`Screen player element ${screenPlayerId} not found`)
                  }
                }, 100)
              } else {
                // Regular video track
                const playerId = `remote-player-${user.uid}`
                const playerElement = document.getElementById(playerId)

                if (playerElement) {
                  remoteVideoTrack.play(playerId)
                  console.log(`Playing remote video for user ${user.uid}`)
                } else {
                  console.warn(`Player element ${playerId} not found`)
                }
              }
            }

            if (mediaType === 'audio') {
              user.audioTrack?.play()
              console.log(`Playing remote audio for user ${user.uid}`)
            }

            // Update participants list - match by userId (Agora UID should be the userId string)
            let existingParticipant = participants.value.find(p => p.uid === user.uid || p.userId === user.uid)
            
            if (existingParticipant) {
              // Update existing participant with Agora UID if not set
              if (!existingParticipant.uid) {
                existingParticipant.uid = user.uid
              }
              console.log(`Updated participant ${existingParticipant.userName} (${user.uid}) with Agora UID`)
            } else {
              // Try to find participant by userId in case UID format is different
              // The userId might be the string, and Agora might convert it
              const participantByUserId = participants.value.find(p => 
                p.userId && (p.userId === user.uid || p.userId.toString() === user.uid.toString())
              )
              
              if (participantByUserId) {
                participantByUserId.uid = user.uid
                console.log(`Matched participant ${participantByUserId.userName} to Agora UID ${user.uid}`)
              } else {
                // If we can't find the participant, refresh the list to get latest data
                console.log(`Could not find participant for Agora UID ${user.uid}, refreshing list...`)
                await refreshParticipantList()
                
                // Try to find again after refresh
                existingParticipant = participants.value.find(p => 
                  p.userId === user.uid || p.userId?.toString() === user.uid.toString()
                )
                
                if (existingParticipant) {
                  existingParticipant.uid = user.uid
                  console.log(`Found participant ${existingParticipant.userName} after refresh`)
                } else {
                  // Last resort: add with generic name
                  participants.value.push({
                    uid: user.uid,
                    userId: user.uid,
                    userName: `User ${user.uid}`,
                    joinedAt: new Date().toISOString()
                  })
                  console.log(`Added participant ${user.uid} with generic name`)
                }
              }
            }
          } catch (subscribeError) {
            console.error(`Failed to subscribe to ${user.uid}'s ${mediaType}:`, subscribeError)
          }
        })

        agoraClient.on('user-unpublished', async (user, mediaType) => {
          if (mediaType === 'video') {
            // Check if this was a screen share
            if (activeScreenShare.value && activeScreenShare.value.uid === user.uid) {
              console.log(`User ${user.uid} stopped sharing screen`)
              activeScreenShare.value = null
            }
            // Video will be automatically removed by Agora
          }
        })

        agoraClient.on('user-left', (user) => {
          // Clear screen share if this user was sharing
          if (activeScreenShare.value && activeScreenShare.value.uid === user.uid) {
            activeScreenShare.value = null
          }
          participants.value = participants.value.filter(p => p.uid !== user.uid)
        })

        // Join the channel
        console.log('Joining Agora channel...', {
          appId: sessionData.appId,
          channel: sessionId.value,
          token: sessionData.token ? `${sessionData.token.substring(0, 20)}...` : 'missing',
          userId: sessionData.userId,
          userIdType: typeof sessionData.userId
        })
        
        try {
          // For web clients, userId can be a string (account) or number (UID)
          const joinResult = await agoraClient.join(
            sessionData.appId,
            sessionId.value,
            sessionData.token,
            sessionData.userId || null // Use userId string for account-based tokens
          )
          console.log('Successfully joined channel:', joinResult)
        } catch (joinError) {
          console.error('Failed to join channel:', joinError)
          console.error('Join error details:', {
            code: joinError.code,
            message: joinError.message,
            name: joinError.name
          })
          
          if (joinError.message && joinError.message.includes('expired')) {
            error.value = 'Session token expired. Please create a new session.'
          } else if (joinError.message && joinError.message.includes('invalid')) {
            error.value = 'Invalid session token. Please check your Agora credentials.'
          } else {
            error.value = `Failed to join video session: ${joinError.message || 'Unknown error'}`
          }
          return
        }

        // Create and publish local tracks
        console.log('Creating microphone and camera tracks...')
        
        // Get preferred devices from sessionStorage (set in PrepareSession)
        const preferredCamera = sessionStorage.getItem('preferredCamera') || null
        const preferredMicrophone = sessionStorage.getItem('preferredMicrophone') || null
        const preferredVideoEnabled = sessionStorage.getItem('preferredVideoEnabled') !== 'false'
        const preferredAudioEnabled = sessionStorage.getItem('preferredAudioEnabled') !== 'false'
        
        try {
          // Create tracks with preferred device selection if available
          // Note: Agora SDK uses cameraId and microphoneId in config
          const config = {
            encoderConfig: {
              width: 640,
              height: 360,
              frameRate: 15,
              bitrateMin: 600,
              bitrateMax: 1000
            }
          }
          
          // Set preferred devices if available
          if (preferredCamera) {
            config.cameraId = preferredCamera
          }
          if (preferredMicrophone) {
            config.microphoneId = preferredMicrophone
          }
          
          localTrack = await AgoraRTC.createMicrophoneAndCameraTracks(config)
          
          // Apply preferred enabled states
          if (!preferredVideoEnabled && localTrack[1]) {
            await localTrack[1].setEnabled(false)
            videoEnabled.value = false
          }
          if (!preferredAudioEnabled && localTrack[0]) {
            await localTrack[0].setEnabled(false)
            audioEnabled.value = false
          }
          
          console.log('Local tracks created:', {
            audio: !!localTrack[0],
            video: !!localTrack[1],
            usingPreferredCamera: !!preferredCamera,
            usingPreferredMicrophone: !!preferredMicrophone
          })
        } catch (trackError) {
          console.error('Failed to create tracks:', trackError)
          error.value = 'Camera/microphone access denied. Please allow permissions and refresh the page.'
          return
        }

        // Display local video
        console.log('Playing local video...')
        const localPlayerElement = document.getElementById('local-player')
        if (localPlayerElement) {
          localTrack[1].play('local-player')
          console.log('Local video playing')
        } else {
          console.error('Local player element not found')
          error.value = 'Video player element not found. Please refresh the page.'
          return
        }

        // Publish tracks
        console.log('Publishing tracks...')
        try {
          await agoraClient.publish(localTrack)
          console.log('Tracks published successfully')
        } catch (publishError) {
          console.error('Failed to publish tracks:', publishError)
          error.value = `Failed to start video/audio: ${publishError.message}`
          return
        }

        // Initialize Agora RTM for chat
        await initRTM()

        // Connect to socket for real-time updates
        // Use the same base URL as the API (extract from sessionService)
        const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/sessions', '') '
        socket = io(socketUrl)
        socket.emit('join-session', {
          sessionId: sessionId.value,
          userId: currentUser.value?.userId
        })

        // Listen for Socket.io user-joined events to update participant list
        socket.on('user-joined', (data) => {
          console.log('User joined via Socket.io:', data)
          // Refresh participant list from API to get updated names
          refreshParticipantList()
        })

        // Listen for Socket.io user-left events
        socket.on('user-left', (data) => {
          console.log('User left via Socket.io:', data)
          // Remove participant from list
          participants.value = participants.value.filter(
            p => p.userId !== data.userId
          )
        })

        // Listen for session ended event
        socket.on('session-ended', async (data) => {
          console.log('Session ended by host:', data)
          
          // Remove from sessionStorage
          sessionStorage.removeItem(`session_${sessionId.value}`)
          
          // Stop all tracks immediately
          if (localTrack) {
            if (localTrack[0]) {
              localTrack[0].stop()
              localTrack[0].close()
            }
            if (localTrack[1]) {
              localTrack[1].stop()
              localTrack[1].close()
            }
          }

          // Leave Agora channel
          if (agoraClient) {
            try {
              await agoraClient.leave()
            } catch (err) {
              console.error('Error leaving channel:', err)
            }
          }

          error.value = 'The host has ended the session. You will be redirected...'
          
          // Cleanup socket connection
          if (socket) {
            socket.off('session-ended')
            socket.disconnect()
          }
          
          // Redirect to home after a short delay
          setTimeout(() => {
            router.push('/')
          }, 2000)
        })

      } catch (err) {
        console.error('Failed to initialize session:', err)
        error.value = 'Failed to join the session. Please check your connection and try again.'
      }
    }

    const toggleAudio = async () => {
      if (localTrack && localTrack[0]) {
        if (audioEnabled.value) {
          await localTrack[0].setEnabled(false)
        } else {
          await localTrack[0].setEnabled(true)
        }
        audioEnabled.value = !audioEnabled.value
      }
    }

    const toggleVideo = async () => {
      // Don't allow enabling video while screen sharing (Agora doesn't allow both)
      if (isScreenSharing.value && videoEnabled.value === false) {
        error.value = 'Cannot enable camera while screen sharing. Please stop screen sharing first.'
        return
      }

      if (localTrack && localTrack[1]) {
        if (videoEnabled.value) {
          await localTrack[1].setEnabled(false)
        } else {
          await localTrack[1].setEnabled(true)
        }
        videoEnabled.value = !videoEnabled.value
      }
    }

    const toggleScreenShare = async () => {
      try {
        if (!agoraClient) {
          error.value = 'Not connected to session'
          return
        }

        if (isScreenSharing.value) {
          // Stop screen sharing and republish camera video
          if (screenTrack) {
            await agoraClient.unpublish(screenTrack)
            screenTrack.close()
            screenTrack = null
          }

          // Republish camera video track if it exists and video is enabled
          if (localTrack && localTrack[1] && videoEnabled.value) {
            try {
              await agoraClient.publish([localTrack[1]])
              console.log('Camera video republished after screen share stopped')
            } catch (err) {
              console.error('Error republishing camera:', err)
            }
          }

          isScreenSharing.value = false
          activeScreenShare.value = null
          console.log('Screen sharing stopped')
        } else {
          // Start screen sharing
          try {
            // Unpublish camera video track first (Agora doesn't allow multiple video tracks)
            if (localTrack && localTrack[1]) {
              try {
                await agoraClient.unpublish([localTrack[1]])
                console.log('Camera video unpublished to allow screen sharing')
              } catch (unpublishErr) {
                console.warn('Error unpublishing camera video:', unpublishErr)
              }
            }

            // Create and publish screen share track
            screenTrack = await AgoraRTC.createScreenVideoTrack({
              encoderConfig: '1080p_1' // High quality screen share
            })

            await agoraClient.publish(screenTrack)
            isScreenSharing.value = true
            activeScreenShare.value = {
              uid: sessionData.userId,
              userName: currentUser.value?.userName || 'You'
            }

            // Play local screen in the screen player
            const screenPlayerId = `screen-player-${sessionData.userId}`
            setTimeout(() => {
              const screenPlayerElement = document.getElementById(screenPlayerId)
              if (screenPlayerElement) {
                screenTrack.play(screenPlayerId)
                console.log('Playing local screen share')
              }
            }, 100)

            // Handle screen track ended (user stops sharing via browser UI)
            screenTrack.on('track-ended', async () => {
              await toggleScreenShare()
            })

            console.log('Screen sharing started')
          } catch (screenError) {
            console.error('Failed to start screen sharing:', screenError)
            
            // If screen share fails, try to republish camera video
            if (localTrack && localTrack[1] && videoEnabled.value) {
              try {
                await agoraClient.publish([localTrack[1]])
              } catch (err) {
                console.error('Error republishing camera after screen share failure:', err)
              }
            }

            if (screenError.name === 'NotAllowedError') {
              error.value = 'Screen sharing permission denied. Please allow access and try again.'
            } else if (screenError.message && screenError.message.includes('CAN_NOT_PUBLISH_MULTIPLE_VIDEO_TRACKS')) {
              error.value = 'Cannot publish multiple video tracks. Please stop your camera first.'
            } else {
              error.value = 'Failed to start screen sharing. Please try again.'
            }
          }
        }
      } catch (err) {
        console.error('Error toggling screen share:', err)
        error.value = 'Failed to toggle screen sharing'
      }
    }

    const isLocalScreenSharing = computed(() => {
      return isScreenSharing.value && activeScreenShare.value?.uid === sessionData?.userId
    })

    const endSession = async () => {
      try {
        if (currentUser.value?.role === 'host') {
          // End session on backend (this will broadcast to all participants)
          await sessionService.endSession(sessionId.value, currentUser.value.userId)
          
          // Remove from sessionStorage
          sessionStorage.removeItem(`session_${sessionId.value}`)
        }

        await cleanup()
        router.push('/')
      } catch (err) {
        console.error('Failed to end session:', err)
        // Still cleanup even if API call fails
        await cleanup()
        router.push('/')
      }
    }

    const copyShareLink = async () => {
      try {
        if (shareLinkInput.value) {
          shareLinkInput.value.select()
          shareLinkInput.value.setSelectionRange(0, 99999)
          await navigator.clipboard.writeText(publicLink.value)
          shareLinkCopied.value = true
          setTimeout(() => {
            shareLinkCopied.value = false
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
        shareLinkCopied.value = true
        setTimeout(() => {
          shareLinkCopied.value = false
        }, 2000)
      }
    }

    // Initialize Agora RTM for chat
    const initRTM = async () => {
      try {
        if (!sessionData || !sessionData.appId) {
          console.warn('Cannot initialize RTM: missing appId')
          rtmReady.value = false
          return
        }

        console.log('Initializing Agora RTM client...')
        rtmClient = AgoraRTM.createInstance(sessionData.appId)
        
        // Login to RTM
        // RTM requires a token when dynamic keys are enabled in Agora console
        const userId = sessionData.userId || `user_${Date.now()}`
        const rtmToken = sessionData.rtmToken || null
        
        // Debug: Log sessionData to check for RTM token
        console.log('RTM initialization - sessionData keys:', Object.keys(sessionData))
        console.log('RTM token present:', !!rtmToken)
        if (rtmToken) {
          console.log('RTM token length:', rtmToken.length)
        }
        
        try {
          if (rtmToken) {
            // Login with token (required when dynamic keys are enabled)
            console.log('Attempting RTM login with token...')
            await rtmClient.login({ uid: userId, token: rtmToken })
            console.log('RTM client logged in with token:', userId)
          } else {
            // Try to login without token (works if dynamic keys are disabled)
            console.log('Attempting RTM login without token (will fail if dynamic keys enabled)...')
            await rtmClient.login({ uid: userId })
            console.log('RTM client logged in without token:', userId)
          }
        } catch (loginError) {
          // If login fails, disable chat but continue with video/audio
          if (loginError.code === 5 || loginError.message?.includes('dynamic key')) {
            console.warn('RTM login failed. Chat feature will be disabled.')
            if (!rtmToken) {
              console.warn('RTM token not provided. Ensure backend generates RTM tokens.')
            }
            rtmReady.value = false
            rtmClient = null
            rtmChannel = null
            return
          }
          throw loginError
        }

        // Create and join channel
        rtmChannel = rtmClient.createChannel(sessionId.value)
        
        // Set up channel event handlers
        rtmChannel.on('ChannelMessage', ({ text }, senderId, messageProps) => {
          console.log('Received RTM message:', { text, senderId })
          const participant = participants.value.find(p => p.userId === senderId || p.uid === senderId)
          addChatMessage({
            id: `msg_${Date.now()}_${Math.random()}`,
            userId: senderId,
            userName: participant?.userName || `User ${senderId}`,
            text: text,
            timestamp: Date.now()
          })
        })

        // Join the channel
        await rtmChannel.join()
        console.log('RTM channel joined:', sessionId.value)
        rtmReady.value = true

      } catch (err) {
        console.error('Failed to initialize RTM:', err)
        // Don't block the session if RTM fails - chat is optional
        // Silently fail - users can still use video/audio
        rtmReady.value = false
        rtmClient = null
        rtmChannel = null
      }
    }

    // Chat functions
    const toggleChat = () => {
      showChat.value = !showChat.value
      if (showChat.value) {
        unreadCount.value = 0
        // Scroll to bottom when opening chat
        nextTick(() => {
          scrollChatToBottom()
        })
      }
    }

    const addChatMessage = (message) => {
      chatMessages.value.push(message)
      // Limit to last 100 messages
      if (chatMessages.value.length > 100) {
        chatMessages.value = chatMessages.value.slice(-100)
      }
      
      // Update unread count if chat is closed
      if (!showChat.value) {
        unreadCount.value++
      }
      
      // Scroll to bottom
      nextTick(() => {
        scrollChatToBottom()
      })
    }

    const scrollChatToBottom = () => {
      if (chatMessagesRef.value) {
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
      }
    }

    const sendChatMessage = async () => {
      if (!chatInput.value.trim() || !rtmReady.value || !rtmChannel) return

      const messageText = chatInput.value.trim()
      chatInput.value = ''

      try {
        await rtmChannel.sendMessage({ text: messageText })
        console.log('Message sent via RTM:', messageText)
        
        // Add message to local chat (optimistic update)
        addChatMessage({
          id: `msg_${Date.now()}_${Math.random()}`,
          userId: currentUser.value?.userId || sessionData?.userId,
          userName: currentUser.value?.userName || 'You',
          text: messageText,
          timestamp: Date.now()
        })
      } catch (err) {
        console.error('Failed to send message:', err)
        error.value = 'Failed to send message. Please try again.'
        // Restore input
        chatInput.value = messageText
      }
    }

    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)
      
      if (minutes < 1) return 'Just now'
      if (minutes < 60) return `${minutes}m ago`
      
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}h ago`
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const cleanup = async () => {
      // Stop screen sharing if active
      if (screenTrack && isScreenSharing.value) {
        try {
          if (agoraClient) {
            await agoraClient.unpublish(screenTrack)
          }
          screenTrack.close()
          screenTrack = null
          isScreenSharing.value = false
          activeScreenShare.value = null
        } catch (err) {
          console.error('Error stopping screen share:', err)
        }
      }

      if (localTrack) {
        localTrack[0]?.close()
        localTrack[1]?.close()
      }

      if (agoraClient) {
        try {
          await agoraClient.leave()
        } catch (err) {
          console.error('Error leaving Agora channel:', err)
        }
      }

      if (socket) {
        // Remove event listeners
        socket.off('session-ended')
        socket.off('user-joined')
        socket.off('user-left')
        
        socket.emit('leave-session', {
          sessionId: sessionId.value,
          userId: currentUser.value?.userId
        })
        socket.disconnect()
      }

      // Cleanup RTM
      rtmReady.value = false
      if (rtmChannel) {
        try {
          await rtmChannel.leave()
          await rtmChannel.release()
        } catch (err) {
          console.error('Error leaving RTM channel:', err)
        }
        rtmChannel = null
      }

      if (rtmClient) {
        try {
          await rtmClient.logout()
        } catch (err) {
          console.error('Error logging out RTM:', err)
        }
        rtmClient = null
      }
    }

    onMounted(() => {
      initAgoraClient()
    })

    onUnmounted(() => {
      cleanup()
    })

    return {
      sessionId,
      sessionName,
      participants,
      currentUser,
      error,
      audioEnabled,
      videoEnabled,
      isScreenSharing,
      activeScreenShare,
      isLocalScreenSharing,
      remoteParticipants,
      showShareModal,
      shareLinkCopied,
      shareLinkInput,
      showFloatingInfo,
      showChat,
      chatMessages,
      chatInput,
      unreadCount,
      chatMessagesRef,
      rtmReady,
      publicLink,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleChat,
      sendChatMessage,
      formatTime,
      endSession,
      copyShareLink
    }
  }
}
</script>

<style scoped>
.session {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background: #0a0a0a;
  color: white;
  overflow: hidden;
  position: relative;
}

/* Floating info bar (top, appears on hover) */
.session-info-float {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 0 0 12px 12px;
  padding: 0.75rem 1.5rem;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.session-info-float.visible {
  opacity: 1;
  pointer-events: all;
}

.float-info-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.session-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.participants-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(102, 126, 234, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  color: #667eea;
  font-weight: 500;
}

/* Floating controls bar (bottom center) */
.floating-controls {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  padding: 0.75rem 1rem;
  border-radius: 50px;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.floating-controls:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6),
              0 0 0 1px rgba(255, 255, 255, 0.15);
}

.floating-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  position: relative;
}

.floating-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.floating-btn.muted {
  background: rgba(220, 53, 69, 0.3);
  border-color: #dc3545;
  color: #ff6b6b;
}

.floating-btn.muted:hover {
  background: rgba(220, 53, 69, 0.4);
}

.floating-btn.active {
  background: rgba(255, 193, 7, 0.3);
  border-color: #ffc107;
  color: #ffc107;
}

.floating-btn.active:hover {
  background: rgba(255, 193, 7, 0.4);
}

.floating-btn.share-btn {
  background: rgba(40, 167, 69, 0.3);
  border-color: #28a745;
  color: #51cf66;
}

.floating-btn.share-btn:hover {
  background: rgba(40, 167, 69, 0.4);
}

.floating-btn.end-btn {
  background: rgba(220, 53, 69, 0.3);
  border-color: #dc3545;
  color: #ff6b6b;
  margin-left: 0.5rem;
  padding-left: 0.75rem;
  border-radius: 24px;
  width: auto;
  padding: 0 1.25rem;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.floating-btn.end-btn:hover {
  background: rgba(220, 53, 69, 0.5);
}

.floating-btn.end-btn::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 60%;
  background: rgba(255, 255, 255, 0.2);
}

.video-container {
  flex: 1;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
}

.video-container.screen-sharing {
  flex-direction: column;
}

/* Single user layout - full screen centered */
.video-container.single-user .video-grid {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  width: 100%;
  height: 100%;
  padding: 2rem;
  box-sizing: border-box;
  overflow: hidden;
}

.video-container.single-user .video-item {
  max-width: 85%;
  max-height: 85vh;
  width: auto;
  height: auto;
  aspect-ratio: 16/9;
  min-height: 400px;
  min-width: 300px;
  flex-shrink: 0;
}

.video-container.single-user .video-grid.with-screen-share {
  max-height: 30vh;
  align-items: flex-start;
  padding: 1rem;
}

.video-container.single-user .video-grid.with-screen-share .video-item {
  max-width: 250px;
  max-height: 25vh;
  min-height: 160px;
  min-width: 200px;
}

/* Screen Share Container */
.screen-share-container {
  width: 100%;
  flex-shrink: 0;
  padding: 1.5rem;
  padding-bottom: 1rem;
  box-sizing: border-box;
}

.screen-share-main {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 16/9;
  min-height: 400px;
  max-height: 65vh;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6),
              0 0 0 2px rgba(102, 126, 234, 0.2);
  transition: all 0.3s ease;
}

.screen-share-main:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7),
              0 0 0 3px rgba(102, 126, 234, 0.3);
}

.screen-player {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 12px;
  object-fit: contain;
}

.screen-share-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  padding: 1.25rem 1.5rem;
  z-index: 10;
}

.screen-share-label {
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(102, 126, 234, 0.2);
  backdrop-filter: blur(10px);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  width: fit-content;
}

.screen-share-label i {
  color: #667eea;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100vh;
  width: 100%;
  box-sizing: border-box;
}

.video-grid.with-screen-share {
  max-height: 35vh;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  min-height: 180px;
  padding: 1rem;
  gap: 0.75rem;
}

/* Custom scrollbar for video grid */
.video-grid::-webkit-scrollbar {
  width: 8px;
}

.video-grid::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.video-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.video-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.video-item {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
  min-height: 180px;
  max-height: 100%;
  width: 100%;
  box-sizing: border-box;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.video-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.video-player {
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: cover;
  border-radius: 8px;
}

.video-player video,
.video-player canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.video-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0.9) 100%);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  z-index: 5;
  min-height: 60px;
  box-sizing: border-box;
}

.participant-name {
  color: white;
  font-weight: 500;
  font-size: 0.9rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.video-controls {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.video-overlay {
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mini-control-btn {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  font-size: 0.85rem;
}

.mini-control-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.mini-control-btn.muted {
  background: rgba(220, 53, 69, 0.8);
  border-color: #dc3545;
  color: #ffc9c9;
}

.mini-control-btn.muted:hover {
  background: rgba(220, 53, 69, 1);
}

.local-video {
  border: 3px solid rgba(102, 126, 234, 0.6);
  box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.2);
}

.local-video:hover {
  border-color: rgba(102, 126, 234, 0.8);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

.screen-share-indicator {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(40, 167, 69, 0.95);
  backdrop-filter: blur(10px);
  color: white;
  padding: 0.35rem 0.75rem;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.screen-share-indicator i {
  font-size: 0.85rem;
}

.video-item.screen-sharer {
  border: 3px solid rgba(40, 167, 69, 0.6);
  box-shadow: 0 0 0 1px rgba(40, 167, 69, 0.2);
}

.video-item.screen-sharer:hover {
  border-color: rgba(40, 167, 69, 0.8);
  box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.3);
}

.error-message {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(220, 53, 69, 0.95);
  backdrop-filter: blur(20px);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 8px 32px rgba(220, 53, 69, 0.4),
              0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 200;
  max-width: 90%;
  font-weight: 500;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.error-message i {
  font-size: 1.2rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: rgba(26, 26, 26, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.7),
              0 0 0 1px rgba(255, 255, 255, 0.1);
  animation: modalSlideIn 0.3s ease-out;
  overflow: hidden;
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
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #ccc;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #333;
  color: white;
}

.modal-body {
  padding: 2rem;
}

.modal-description {
  color: #ccc;
  margin-bottom: 1.5rem;
  text-align: center;
}

.link-container {
  display: flex;
  gap: 0.5rem;
}

.link-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #333;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: monospace;
  background: #000;
  color: white;
}

.btn-copy {
  background: #6c757d;
  color: white;
  padding: 0.75rem 1.5rem;
  white-space: nowrap;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

@media (max-width: 768px) {
  .floating-controls {
    bottom: 1rem;
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }

  .floating-btn {
    width: 44px;
    height: 44px;
    font-size: 1rem;
  }

  .floating-btn.end-btn {
    padding: 0 1rem;
    font-size: 0.85rem;
  }

  .video-container.single-user .video-item {
    max-width: 95%;
    max-height: 75%;
  }

  .video-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 1rem;
  }

  .video-grid.with-screen-share {
    max-height: 30vh;
    min-height: 160px;
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .video-item {
    min-height: 160px;
    max-height: 40vh;
  }

  .screen-share-container {
    padding: 1rem;
    padding-bottom: 0.75rem;
  }

  .screen-share-main {
    min-height: 250px;
    max-height: 55vh;
    border-radius: 8px;
  }

  .screen-share-overlay {
    padding: 1rem;
  }

  .screen-share-label {
    font-size: 0.85rem;
    padding: 0.4rem 0.75rem;
  }

  .participant-name {
    max-width: 150px;
    font-size: 0.85rem;
  }

  .modal-content {
    margin: 0.5rem;
    border-radius: 12px;
  }

  .modal-header,
  .modal-body {
    padding: 1.25rem;
  }

  .link-container {
    flex-direction: column;
  }

  .error-message {
    bottom: 80px;
    padding: 0.875rem 1.25rem;
    font-size: 0.9rem;
    max-width: calc(100% - 2rem);
  }
}

/* Chat Panel Styles */
.chat-panel {
  position: fixed;
  right: -400px;
  top: 0;
  width: 400px;
  height: 100vh;
  background: rgba(26, 26, 26, 0.98);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
}

.chat-panel.chat-open {
  right: 0;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.chat-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chat-header h3 i {
  color: #667eea;
}

.chat-close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.chat-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.chat-message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  max-width: 85%;
  word-wrap: break-word;
}

.chat-message.own-message {
  align-self: flex-end;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.3);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.message-sender {
  font-size: 0.85rem;
  font-weight: 600;
  color: #667eea;
}

.chat-message.own-message .message-sender {
  color: #51cf66;
}

.message-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.message-content {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: 2rem;
}

.chat-empty i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}

.chat-empty p {
  margin: 0;
  font-size: 0.9rem;
}

.chat-input-container {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.chat-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  color: white;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.chat-input:focus {
  outline: none;
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.chat-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-send-btn {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chat-send-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.chat-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #dc3545;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  line-height: 1.2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.floating-btn {
  position: relative;
}

@media (max-width: 768px) {
  .chat-panel {
    width: 100%;
    right: -100%;
  }

  .chat-header {
    padding: 1rem;
  }

  .chat-messages {
    padding: 0.75rem;
  }

  .chat-input-container {
    padding: 0.75rem 1rem;
  }
}
</style>
