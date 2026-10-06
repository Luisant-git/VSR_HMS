const API_URL = import.meta.env.VITE_API_URL;

export const gateLogApi = {
  getAll: async (page = 1, limit = 10, search = '', fromDate = '', toDate = '', status = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(fromDate && { fromDate }),
      ...(toDate && { toDate }),
      ...(status && { status })
    });
    const res = await fetch(`${API_URL}/gate-logs?${params}`);
    if (!res.ok) throw new Error('Failed to fetch gate logs');
    return res.json();
  },
  
  create: async (data: any) => {
    const res = await fetch(`${API_URL}/gate-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create gate log');
    }
    return res.json();
  },

  getMissing: async (params?: { page?: number, limit?: number, search?: string, fromDate?: string, toDate?: string }) => {
    let url = `${API_URL}/gate-logs/missing`;
    if (params) {
      const query = new URLSearchParams();
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());
      if (params.search) query.append('search', params.search);
      if (params.fromDate) query.append('fromDate', params.fromDate);
      if (params.toDate) query.append('toDate', params.toDate);
      if (query.toString()) url += `?${query.toString()}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch missing/late logs');
    return res.json();
  }
};
