const API_URL = import.meta.env.VITE_API_URL;

export const DeveloperAPI = {
  truncate: async (data: { entity: string; passwordConfirm: string }) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const response = await fetch(`${API_URL}/developer/truncate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to truncate');
    return response.json();
  }
};
