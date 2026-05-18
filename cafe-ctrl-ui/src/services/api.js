import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : 'http://localhost:8080/api',
  withCredentials: true,
});

// This is like an Angular Interceptor. 
// It automatically attaches the JWT token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;