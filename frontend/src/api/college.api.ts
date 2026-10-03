const API_URL = import.meta.env.VITE_API_URL;

export interface CreateCollegeDto {
  name: string;
  shortName?: string;
  address?: string;
  dueDate?: string;
  finePerDay?: number;
}

export const CollegeAPI = {
  async create(data: CreateCollegeDto) {
    const res = await fetch(`${API_URL}/colleges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create college');
    }
    return res.json();
  },

  async findAll(params?: { page?: number; limit?: number; search?: string; dueDate?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.dueDate) query.append('dueDate', params.dueDate);
    
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/colleges${queryString}`);
    if (!res.ok) throw new Error('Failed to fetch colleges');
    return res.json();
  },

  async findOne(id: string) {
    const res = await fetch(`${API_URL}/colleges/${id}`);
    if (!res.ok) throw new Error('Failed to fetch college');
    return res.json();
  },

  async update(id: string, data: any) {
    const res = await fetch(`${API_URL}/colleges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update college');
    }
    return res.json();
  },

  async updateBulk(data: any) {
    const res = await fetch(`${API_URL}/colleges/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to bulk update fine configurations');
    }
    return res.json();
  },

  async remove(id: string) {
    const res = await fetch(`${API_URL}/colleges/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete college');
    return res.json();
  }
};
