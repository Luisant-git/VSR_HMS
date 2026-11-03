const API_URL = import.meta.env.VITE_API_URL;

export const EbBillsAPI = {
  async create(data: any) {
    const res = await fetch(`${API_URL}/eb-bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create EB Bill');
    }
    return res.json();
  },

  async update(id: string, data: any) {
    const res = await fetch(`${API_URL}/eb-bills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update EB Bill');
    }
    return res.json();
  },

  async remove(id: string) {
    const res = await fetch(`${API_URL}/eb-bills/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete EB Bill');
    }
    return res.json();
  },

  async findAll(params?: { page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string; billingCycle?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    if (params?.billingCycle) query.append('billingCycle', params.billingCycle);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/eb-bills${queryString}`);
    if (!res.ok) throw new Error('Failed to fetch EB Bills');
    return res.json();
  },

  async findBillingCycles(): Promise<string[]> {
    const res = await fetch(`${API_URL}/eb-bills/cycles`);
    if (!res.ok) throw new Error('Failed to fetch EB billing cycles');
    return res.json();
  },

  async findByRoom(roomNo: string) {
    const res = await fetch(`${API_URL}/eb-bills/room/${roomNo}`);
    if (!res.ok) throw new Error('Failed to fetch EB Bills for room');
    return res.json();
  }
};
