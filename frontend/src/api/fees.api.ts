const API_URL = import.meta.env.VITE_API_URL;

const developerRequest = async (path: string, init?: RequestInit) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) throw new Error('Please sign in again to manage the fee trash.');

  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.message || 'Failed to manage fee trash');
  }
  return res.json();
};

export const FeesAPI = {
  async previewFine(studentId: string, asOfDate: string) {
    const query = new URLSearchParams({ asOfDate });
    const res = await fetch(`${API_URL}/fees/fine-preview/${encodeURIComponent(studentId)}?${query}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to calculate the fine for this date');
    }
    return res.json() as Promise<{
      asOfDate: string;
      daysOverdue: number;
      dailyFine: number;
      amount: number;
      currentAmount: number;
      fines: Array<{
        key: 'rent' | 'mess' | 'eb';
        label: string;
        rate: number;
        dueDate: string;
        daysOverdue: number;
        currentDaysOverdue: number;
        amount: number;
        currentAmount: number;
      }>;
      pendingFines: Array<{
        id: string;
        studentId: string;
        amount: number;
        description: string | null;
        status: string;
        billingMonth: string | null;
        dueDate: string | null;
        createdAt: string;
      }>;
    }>;
  },

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
    // Fail fast instead of leaving the Fees table on "Loading..." forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/fees`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(error?.message || `Failed to fetch fee transactions (HTTP ${res.status})`);
    }
    return res.json();
  },

  async findTrash() {
    return developerRequest('/fees/trash');
  },

  async moveToTrash(ids: string[]) {
    return developerRequest('/fees/trash', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async restoreFromTrash(id: string) {
    return this.restoreTrashRows([id]);
  },

  async restoreTrashRows(ids: string[]) {
    return developerRequest('/fees/trash/restore', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
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
    paidDate?: string;
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

  async importEdits(
    rows: Array<{
      studentKey: string;
      rent?: number;
      eb?: number;
      fine?: number;
      advance?: number;
    }>,
    dryRun = false,
  ) {
    const res = await fetch(`${API_URL}/fees/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, dryRun }),
    });
    if (!res.ok) {
      let message = 'Failed to import fees from Excel';
      try {
        const error = await res.json();
        if (error?.message) {
          message = Array.isArray(error.message)
            ? error.message.join(', ')
            : error.message;
        }
      } catch {
        // keep the generic message when the server did not return JSON
      }
      throw new Error(message);
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
