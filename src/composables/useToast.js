import { reactive, readonly } from 'vue'

const state = reactive({
  toasts: []
})

let nextId = 1

const removeToast = (id) => {
  const index = state.toasts.findIndex((toast) => toast.id === id)
  if (index !== -1) {
    state.toasts.splice(index, 1)
  }
}

const showToast = (message, type = 'info', duration = 3000) => {
  const id = nextId++
  state.toasts.push({ id, message, type })

  if (duration && duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

export const useToast = () => ({
  toasts: readonly(state.toasts),
  showToast,
  removeToast
})

