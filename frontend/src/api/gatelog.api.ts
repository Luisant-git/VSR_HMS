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

  getMissing: async () => {
    const res = await fetch(`${API_URL}/gate-logs/missing`);
    if (!res.ok) throw new Error('Failed to fetch missing/late logs');
    return res.json();
  }
};
