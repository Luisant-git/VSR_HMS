const API_URL = import.meta.env.VITE_API_URL;

const getHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const UserAPI = {
  login: async (credentials: any) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(credentials)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Login failed');
    }
    return response.json();
  },

  getAll: async (params?: { page: number; limit: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());
      if (params.search) query.append('search', params.search);
    }
    const response = await fetch(`${API_URL}/users?${query.toString()}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  create: async (data: any) => {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  },

  update: async (id: string, data: any) => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },

  toggleActive: async (id: string) => {
    const response = await fetch(`${API_URL}/users/${id}/toggle-active`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to toggle user status');
    return response.json();
  }
};
