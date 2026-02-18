import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5500/api',
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token from storage on init
const token = localStorage.getItem('incentive_token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('incentive_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

