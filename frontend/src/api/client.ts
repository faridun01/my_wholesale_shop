import axios from 'axios';
import { clearAuthSession } from '../utils/authStorage';

const API_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return 'http://localhost:3001/api';
  }

  return '/api';
})();

const client = axios.create({
  baseURL: API_URL,
  timeout: 180000, // 3 minutes
  withCredentials: true,
});

const getReadableNetworkMessage = (error: any) => {
  const rawMessage = String(error?.message || '').toLowerCase();
  const errorCode = String(error?.code || '').toUpperCase();

  if (errorCode === 'ECONNABORTED' || rawMessage.includes('timeout')) {
    return 'Сервер долго не отвечает. Попробуйте ещё раз.';
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Нет подключения к интернету.';
  }

  return 'Не удалось связаться с сервером. Проверьте, запущен ли backend и доступен ли API.';
};

client.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle unauthorized errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearAuthSession();
      window.location.href = '/login';
    }

    if (!error.response) {
      error.message = getReadableNetworkMessage(error);
    }

    return Promise.reject(error);
  }
);

export default client;
