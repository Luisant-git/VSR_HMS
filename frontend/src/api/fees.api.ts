const API_URL = import.meta.env.VITE_API_URL;

export const FeesAPI = {
  async create(data: any) {
    const res = await fetch(`${API_URL}/fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create fee transaction');
    }
    return res.json();
  },

  async findAll() {
    const res = await fetch(`${API_URL}/fees`);
    if (!res.ok) throw new Error('Failed to fetch fee transactions');
    return res.json();
  },

  async findByStudent(studentId: string) {
    const res = await fetch(`${API_URL}/fees/student/${studentId}`);
    if (!res.ok) throw new Error('Failed to fetch fee transactions');
    return res.json();
  },

  async update(id: string, data: any) {
    const res = await fetch(`${API_URL}/fees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update fee transaction');
    }
    return res.json();
  }
};
