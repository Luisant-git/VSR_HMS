const API_URL = import.meta.env.VITE_API_URL;

export const OutpassAPI = {
  findAll: async (params?: { page?: number, limit?: number, search?: string, fromDate?: string, toDate?: string }) => {
    let url = `${API_URL}/outpass`;
    if (params) {
      const query = new URLSearchParams();
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());
      if (params.search) query.append('search', params.search);
      if (params.fromDate) query.append('fromDate', params.fromDate);
      if (params.toDate) query.append('toDate', params.toDate);
      if (query.toString()) url += `?${query.toString()}`;
    }
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    if (!res.ok) throw new Error('Failed to fetch outpasses');
    return res.json();
  },
  
  create: async (data: any) => {
    const res = await fetch(`${API_URL}/outpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create outpass');
    return res.json();
  },
  
  updateStatus: async (id: string, data: { status: string, gateAction: string }) => {
    const res = await fetch(`${API_URL}/outpass/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update outpass status');
    return res.json();
  }
};
