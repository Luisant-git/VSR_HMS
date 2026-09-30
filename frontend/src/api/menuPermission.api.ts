import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: `${API_URL}/menu-permission`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const MenuPermissionAPI = {
  getAll: async () => {
    const response = await api.get('/all');
    return response.data;
  },

  getByRole: async (role: string) => {
    const response = await api.get(`/role/${role}`);
    return response.data;
  },

  upsert: async (role: string, permissions: any) => {
    const response = await api.post('/', { role, permissions });
    return response.data;
  }
};
