const API_URL = import.meta.env.VITE_API_URL;

export const ClearanceAPI = {
  create: async (data: { studentId: string; reason: string; deductions?: number; remarks?: string }) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/clearance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create clearance');
    return response.json();
  },
  findAll: async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/clearance`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) throw new Error('Failed to fetch clearances');
    return response.json();
  },
  findOne: async (id: string) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/clearance/${id}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) throw new Error('Failed to fetch clearance');
    return response.json();
  }
};
