const API_URL = import.meta.env.VITE_API_URL;

export interface RoleItem {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const getHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseError = async (response: Response, fallback: string) => {
  const errorData = await response.json().catch(() => null);
  return errorData?.message || fallback;
};

export const RoleAPI = {
  getAll: async (activeOnly = false): Promise<RoleItem[]> => {
    const query = activeOnly ? '?activeOnly=true' : '';
    const response = await fetch(`${API_URL}/roles${query}`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to fetch roles'));
    }
    return response.json();
  },

  create: async (data: {
    name: string;
    label: string;
    description?: string;
    isActive?: boolean;
  }): Promise<RoleItem> => {
    const response = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to create role'));
    }
    return response.json();
  },

  update: async (
    id: string,
    data: { name?: string; label?: string; description?: string; isActive?: boolean },
  ): Promise<RoleItem> => {
    const response = await fetch(`${API_URL}/roles/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to update role'));
    }
    return response.json();
  },

  toggleActive: async (id: string): Promise<RoleItem> => {
    const response = await fetch(`${API_URL}/roles/${id}/toggle-active`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to toggle role status'));
    }
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/roles/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to delete role'));
    }
  },
};
