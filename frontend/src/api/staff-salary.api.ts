import type { StaffMember } from './staff.api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export interface StaffSalaryItem {
  id: string;
  salaryCode: string;
  staffId: string;
  staff?: StaffMember;
  salaryMonth: string;
  year: number;
  month: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  netAmount: number;
  paymentDate: string;
  paymentMode: string;
  remarks?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryPayload {
  staffId: string;
  month: string;
  year: number;
  baseSalary: number;
  bonus?: number;
  deductions?: number;
  paymentDate?: string;
  paymentMode?: string;
  remarks?: string;
}

export interface UpdateSalaryPayload {
  baseSalary?: number;
  bonus?: number;
  deductions?: number;
  paymentDate?: string;
  paymentMode?: string;
  remarks?: string;
}

export interface SalaryListResponse {
  records: StaffSalaryItem[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalDisbursed: number;
    totalRecords: number;
    staffCount: number;
  };
}

export const StaffSalaryAPI = {
  async getAttendanceStats(staffId: string, month: string, year: number | string): Promise<{
    presentDays: number;
    halfDays: number;
    absentDays: number;
    leaveDays: number;
    payableDays: number;
    totalDays: number;
    recordedDays: number;
  } | null> {
    try {
      const res = await fetch(
        `${API_BASE}/staff-salary/attendance-stats?staffId=${staffId}&month=${month}&year=${year}`,
        { headers: getHeaders() }
      );
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getAll(params?: {
    search?: string;
    month?: string;
    year?: string | number;
    staffId?: string;
    page?: number;
    limit?: number;
  }): Promise<SalaryListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.month && params.month !== 'ALL') searchParams.append('month', params.month);
    if (params?.year && params.year !== 'ALL') searchParams.append('year', String(params.year));
    if (params?.staffId && params.staffId !== 'ALL') searchParams.append('staffId', params.staffId);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));

    const url = `${API_BASE}/staff-salary?${searchParams.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch salary records');
    }

    return res.json();
  },

  async getById(id: string): Promise<StaffSalaryItem> {
    const res = await fetch(`${API_BASE}/staff-salary/${id}`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch salary record');
    }
    return res.json();
  },

  async create(data: CreateSalaryPayload): Promise<StaffSalaryItem> {
    const res = await fetch(`${API_BASE}/staff-salary`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to record salary disbursement');
    }
    return res.json();
  },

  async update(id: string, data: UpdateSalaryPayload): Promise<StaffSalaryItem> {
    const res = await fetch(`${API_BASE}/staff-salary/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update salary record');
    }
    return res.json();
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/staff-salary/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete salary record');
    }
    return res.json();
  }
};
