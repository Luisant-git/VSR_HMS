import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL}/system-settings`;

export const getSystemSettings = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const updateSystemSettings = async (data: any) => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  const response = await axios.post(API_URL, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
