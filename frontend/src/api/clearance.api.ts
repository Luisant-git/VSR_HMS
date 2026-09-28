import axios from 'axios';

const API_URL = 'http://localhost:3000/clearance';

export const ClearanceAPI = {
  create: async (data: { studentId: string; reason: string; deductions?: number; remarks?: string }) => {
    const response = await axios.post(API_URL, data);
    return response.data;
  },
  findAll: async () => {
    const response = await axios.get(API_URL);
    return response.data;
  },
  findOne: async (id: string) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
  }
};
