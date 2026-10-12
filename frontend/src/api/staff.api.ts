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

export interface StaffMember {
  id: string;
  staffCode: string;
  name: string;
  joiningDate: string;
  role: string;
  phone?: string;
  email?: string;
  salaryBasis: string;
  baseSalary: number;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const StaffAPI = {
  getAll: async (params?: { search?: string; role?: string; salaryBasis?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.role && params.role !== 'ALL') query.append('role', params.role);
    if (params?.salaryBasis && params.salaryBasis !== 'ALL') query.append('salaryBasis', params.salaryBasis);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/staff${queryString}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  getNextCode: async () => {
    const res = await fetch(`${API_URL}/staff/next-code`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  getOne: async (id: string) => {
    const res = await fetch(`${API_URL}/staff/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  create: async (data: Partial<StaffMember>) => {
    const res = await fetch(`${API_URL}/staff`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  update: async (id: string, data: Partial<StaffMember>) => {
    const res = await fetch(`${API_URL}/staff/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  toggleStatus: async (id: string) => {
    const res = await fetch(`${API_URL}/staff/${id}/toggle-status`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/staff/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  }
};
