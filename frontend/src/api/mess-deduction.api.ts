const API_URL = import.meta.env.VITE_API_URL;

export const MessDeductionAPI = {
  getSettings: async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/mess-deduction`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },
  updateSettings: async (data: { messDeductionThreshold: number }) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/mess-deduction`, { 
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  }
};
