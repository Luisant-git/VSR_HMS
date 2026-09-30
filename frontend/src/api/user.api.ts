import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: `${API_URL}/users`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const UserAPI = {
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials, {
      baseURL: API_URL
    });
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/');
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/${id}`, data);
    return response.data;
  },

  toggleActive: async (id: string) => {
    const response = await api.patch(`/${id}/toggle-active`);
    return response.data;
  }
};
