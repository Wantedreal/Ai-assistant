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

  // Export STEP file
  exportStep: (payload) => api.post('/export/step', payload, {
    responseType: 'blob',
  }),

  // Import cell catalogue from uploaded .xlsx file
  importCells: (file, sourcePath) => {
    const form = new FormData()
    form.append('file', file)
    if (sourcePath) form.append('source_path', sourcePath)
    return api.post('/cells/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Re-import from the last saved source path
  syncCells: () => api.post('/cells/sync'),

  // Get saved source path
  getImportConfig: () => api.get('/cells/import/config'),

  // Manually set source Excel path (for non-Electron environments)
  setImportConfig: (path) => api.post('/cells/import/config', { source_path: path }),

  // Clear the saved source Excel path
  clearImportConfig: () => api.delete('/cells/import/config'),

  // Recommend top 5 cells for given constraints
  recommendCells: (payload) => api.post('/cells/recommend', payload),

  // Phase A — compare multiple cells against the same constraints in parallel
  compareCards: (payloads) => Promise.all(payloads.map(p => api.post('/calculate', p))),

  // Phase B — Calculation history
  getHistory: (limit = 50) => api.get(`/history?limit=${limit}`),
  deleteHistoryEntry: (id) => api.delete(`/history/${id}`),
  clearHistory: () => api.delete('/history'),

  // AI explainer
  explainResult: (payload) => api.post('/explain', payload),

  // Add a new cell to the catalogue (DB + Excel)
  addCell: (payload) => api.post('/cells', payload),
}

export default api
