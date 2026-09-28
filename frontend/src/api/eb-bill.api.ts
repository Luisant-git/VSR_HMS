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

  async findAll() {
    const res = await fetch(`${API_URL}/eb-bills`);
    if (!res.ok) throw new Error('Failed to fetch EB Bills');
    return res.json();
  },

  async findByRoom(roomNo: string) {
    const res = await fetch(`${API_URL}/eb-bills/room/${roomNo}`);
    if (!res.ok) throw new Error('Failed to fetch EB Bills for room');
    return res.json();
  }
};
