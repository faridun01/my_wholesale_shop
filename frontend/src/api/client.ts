import axios from 'axios';
import { clearAuthSession, getAuthToken } from '../utils/authStorage';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
});

// Add auth token automatically
client.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle unauthorized responses
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearAuthSession();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default client;
