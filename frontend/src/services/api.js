import axios from 'axios'

// Create axios instance with base URL pointing to the backend
// Use absolute URL to work in both web and Electron contexts
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1',
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
  
  // Generate PDF report
  generatePdf: (payload) => api.post('/calculate/pdf', payload, {
    responseType: 'blob',
  }),
}

export default api
