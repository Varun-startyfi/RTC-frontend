import axios from 'axios'

const API_BASE_URL = 'http://localhost:3001/api/sessions'

class SessionService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  async createSession(data) {
    const response = await this.client.post('/create', data)
    return response.data
  }

  async joinSession(sessionId, data) {
    const response = await this.client.post(`/${sessionId}/join`, data)
    return response.data
  }

  async getSession(sessionId) {
    const response = await this.client.get(`/${sessionId}`)
    return response.data
  }

  async endSession(sessionId, userId) {
    const response = await this.client.post(`/${sessionId}/end`, { userId })
    return response.data
  }
}

export default new SessionService()
