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
  },

  getAttendanceRoster: async (date?: string) => {
    const query = date ? `?date=${date}` : '';
    const res = await fetch(`${API_URL}/staff/attendance/roster${query}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  saveAttendance: async (data: {
    staffId: string;
    dateStr: string;
    checkInTime?: string;
    checkOutTime?: string;
    status?: string;
    remarks?: string;
  }) => {
    const res = await fetch(`${API_URL}/staff/attendance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  recordPunch: async (data: {
    staffId?: string;
    staffCode?: string;
    dateStr?: string;
    timeStr?: string;
    timestamp?: string;
    type?: 'IN' | 'OUT' | 'AUTO';
  }) => {
    const res = await fetch(`${API_URL}/staff/attendance/punch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  getAttendanceHistory: async (params?: {
    staffId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.staffId && params.staffId !== 'ALL') query.append('staffId', params.staffId);
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/staff/attendance/history${qs}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  }
};

export interface StaffAttendanceItem {
  staffId: string;
  staffCode: string;
  name: string;
  role: string;
  phone?: string;
  dateStr: string;
  attendanceId?: string | null;
  checkInTime: string;
  checkOutTime: string;
  status: string;
  workDuration?: string;
  durationMinutes?: number | null;
  classification?: 'FULL_DAY' | 'HALF_DAY' | 'INSUFFICIENT' | 'PENDING' | 'NOT_MARKED';
  remarks?: string;
}

