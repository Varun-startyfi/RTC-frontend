<template>
  <teleport to="body">
    <div class="toast-container">
      <transition-group name="toast-fade" tag="div">
        <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
          <i :class="toast.type === 'error' ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle'"></i>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" @click="removeToast(toast.id)" aria-label="Dismiss notification">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script>
import { useToast } from '../composables/useToast'

export default {
  name: 'ToastContainer',
  setup() {
    const { toasts, removeToast } = useToast()

    return {
      toasts,
      removeToast
    }
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 9999;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.35);
  min-width: 260px;
}

.toast.error {
  border: 1px solid rgba(239, 68, 68, 0.7);
}

.toast.success {
  border: 1px solid rgba(34, 197, 94, 0.7);
}

.toast-message {
  flex: 1;
  font-size: 0.95rem;
}

.toast-close {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.2rem;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .toast-container {
    left: 16px;
    right: 16px;
    top: 16px;
  }

  .toast {
    min-width: auto;
  }
}
</style>

