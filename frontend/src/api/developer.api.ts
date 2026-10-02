import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: `${API_URL}/developer`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const DeveloperAPI = {
  truncate: async (data: { entity: string; passwordConfirm: string }) => {
    const response = await api.post('/truncate', data);
    return response.data;
  }
};
