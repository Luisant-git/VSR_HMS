const API_URL = import.meta.env.VITE_API_URL;

export const EbTariffAPI = {
  async get(): Promise<{ id: string; rate: number; updatedAt?: string | null }> {
    const res = await fetch(`${API_URL}/eb-tariff`);
    if (!res.ok) throw new Error('Failed to fetch electricity tariff rate');
    return res.json();
  },

  async update(rate: number) {
    const res = await fetch(`${API_URL}/eb-tariff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update electricity tariff rate');
    }
    return res.json();
  },
};
