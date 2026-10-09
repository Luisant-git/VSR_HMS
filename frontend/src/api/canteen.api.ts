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

export const CanteenAPI = {
  // Categories
  getCategories: async () => {
    const res = await fetch(`${API_URL}/canteen/categories`, { headers: getHeaders() });
    return handleResponse(res);
  },
  createCategory: async (data: { name: string; description?: string }) => {
    const res = await fetch(`${API_URL}/canteen/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  updateCategory: async (id: string, data: { name?: string; description?: string }) => {
    const res = await fetch(`${API_URL}/canteen/categories/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  deleteCategory: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },


  // Units
  getUnits: async () => {
    const res = await fetch(`${API_URL}/canteen/units`, { headers: getHeaders() });
    return handleResponse(res);
  },
  createUnit: async (data: { name: string; symbol?: string }) => {
    const res = await fetch(`${API_URL}/canteen/units`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  updateUnit: async (id: string, data: { name?: string; symbol?: string }) => {
    const res = await fetch(`${API_URL}/canteen/units/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  deleteUnit: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/units/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Suppliers
  getSuppliers: async () => {
    const res = await fetch(`${API_URL}/canteen/suppliers`, { headers: getHeaders() });
    return handleResponse(res);
  },
  createSupplier: async (data: { name: string; phone?: string; email?: string; address?: string; gstNo?: string }) => {
    const res = await fetch(`${API_URL}/canteen/suppliers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  updateSupplier: async (id: string, data: { name?: string; phone?: string; email?: string; address?: string; gstNo?: string }) => {
    const res = await fetch(`${API_URL}/canteen/suppliers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  deleteSupplier: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/suppliers/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Payment Modes
  getPaymentModes: async () => {
    const res = await fetch(`${API_URL}/canteen/payment-modes`, { headers: getHeaders() });
    return handleResponse(res);
  },
  createPaymentMode: async (data: { name: string }) => {
    const res = await fetch(`${API_URL}/canteen/payment-modes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  updatePaymentMode: async (id: string, data: { name?: string }) => {
    const res = await fetch(`${API_URL}/canteen/payment-modes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  deletePaymentMode: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/payment-modes/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Products
  getProducts: async () => {
    const res = await fetch(`${API_URL}/canteen/products`, { headers: getHeaders() });
    return handleResponse(res);
  },
  createProduct: async (data: any) => {
    const res = await fetch(`${API_URL}/canteen/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  updateProduct: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/canteen/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  deleteProduct: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/products/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Purchases
  getPurchases: async () => {
    const res = await fetch(`${API_URL}/canteen/purchases`, { headers: getHeaders() });
    return handleResponse(res);
  },
  getPurchaseById: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/purchases/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  createPurchase: async (data: any) => {
    const res = await fetch(`${API_URL}/canteen/purchases`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  deletePurchase: async (id: string) => {
    const res = await fetch(`${API_URL}/canteen/purchases/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },
};
