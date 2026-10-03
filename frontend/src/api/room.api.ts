const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export interface CreateRoomDto {
  id: string;
  block: string;
  floor?: number;
  capacity: number;
  type: string;
  rent?: number;
  messFee?: number;
  amenities?: string;
}

export const RoomAPI = {
  findAll: async () => {
    const response = await fetch(`${API_URL}/rooms`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch rooms');
    return response.json();
  },

  create: async (data: CreateRoomDto) => {
    const response = await fetch(`${API_URL}/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Failed to create room');
    }
    return response.json();
  },

  update: async (id: string, data: Partial<CreateRoomDto>) => {
    const response = await fetch(`${API_URL}/rooms/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Failed to update room');
    }
    return response.json();
  }
};
