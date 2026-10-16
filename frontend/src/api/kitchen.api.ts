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

export const KitchenAPI = {
  // Products (from Canteen)
  getProducts: async () => {
    const res = await fetch(`${API_URL}/kitchen/products`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Stock report (closing stock as on a given date)
  getStockReport: async (date: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const res = await fetch(`${API_URL}/kitchen/stock-report?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Consumptions
  getConsumptions: async (filters?: { dateStr?: string; mealType?: string; productId?: string; fromDate?: string; toDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.dateStr) params.append('dateStr', filters.dateStr);
    if (filters?.mealType) params.append('mealType', filters.mealType);
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    const res = await fetch(`${API_URL}/kitchen/consumptions?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  createConsumption: async (data: {
    dateStr: string;
    mealType: string;
    productId: string;
    quantityTaken: number;
    wastage?: number;
    remarks?: string;
    batchId?: string;
  }) => {
    const res = await fetch(`${API_URL}/kitchen/consumptions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateConsumption: async (id: string, data: {
    mealType?: string;
    productId?: string;
    dateStr?: string;
    quantityTaken?: number;
    wastage?: number;
    remarks?: string;
  }) => {
    const res = await fetch(`${API_URL}/kitchen/consumptions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  deleteConsumption: async (id: string) => {
    const res = await fetch(`${API_URL}/kitchen/consumptions/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },
};
