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
  },

  async payOutstanding(data: {
    studentId: string;
    amount: number;
    paymentMode: string;
    referenceNumber?: string;
    notes?: string;
    requestId?: string;
  }) {
    const res = await fetch(`${API_URL}/fees/pay-outstanding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to process outstanding payment');
    }
    return res.json();
  },

  async createRazorpayOrder(data: {
    studentId: string;
    feeItems: Array<{ feeId: string; months: number }>;
    outstandingAmount: number;
    requestId: string;
  }) {
    const res = await fetch(`${API_URL}/fees/razorpay/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to start online payment');
    }
    return res.json();
  },

  async verifyRazorpayPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const res = await fetch(`${API_URL}/fees/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to verify online payment');
    }
    return res.json();
  },

  async reconcileRazorpayOrder(data: { orderId: string }) {
    const res = await fetch(`${API_URL}/fees/razorpay/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to check online payment status');
    }
    return res.json();
  },

  async reconcileRecentRazorpayStudentOrders(data: { studentId: string }) {
    const res = await fetch(`${API_URL}/fees/razorpay/reconcile-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to check recent online payments');
    }
    return res.json();
  },
};
