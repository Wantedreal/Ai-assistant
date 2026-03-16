import axios from 'axios'

// Create axios instance with base URL pointing to the proxy
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// API endpoints
export const apiService = {
  // Health check
  health: () => api.get('/health'),
  
  // Get all battery cells
  getCells: () => api.get('/cells'),
  
  // Get single cell details
  getCell: (cellId) => api.get(`/cells/${cellId}`),
  
  // Calculate battery pack specifications
  calculate: (payload) => api.post('/calculate', payload),
}

export default api
