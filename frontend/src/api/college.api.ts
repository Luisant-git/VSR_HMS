const API_URL = import.meta.env.VITE_API_URL;

export interface CreateCollegeDto {
  name: string;
  shortName?: string;
  address?: string;
  lastDate?: string;
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

  async findAll() {
    const res = await fetch(`${API_URL}/colleges`);
    if (!res.ok) throw new Error('Failed to fetch colleges');
    return res.json();
  },

  async findOne(id: string) {
    const res = await fetch(`${API_URL}/colleges/${id}`);
    if (!res.ok) throw new Error('Failed to fetch college');
    return res.json();
  },

  async update(id: string, data: Partial<CreateCollegeDto>) {
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

  async remove(id: string) {
    const res = await fetch(`${API_URL}/colleges/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete college');
    return res.json();
  }
};
