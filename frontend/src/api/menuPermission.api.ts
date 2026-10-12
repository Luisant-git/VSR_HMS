const API_URL = import.meta.env.VITE_API_URL;

const getHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || `Request failed with status ${res.status}`);
  }
  return res.json();
};

export const MenuPermissionAPI = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/menu-permission/all`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  getByRole: async (role: string) => {
    const response = await fetch(`${API_URL}/menu-permission/role/${role}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  upsert: async (role: string, permissions: any) => {
    const response = await fetch(`${API_URL}/menu-permission`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ role, permissions })
    });
    return handleResponse(response);
  }
};
