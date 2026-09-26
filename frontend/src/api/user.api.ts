const API_URL = import.meta.env.VITE_API_URL;

export interface CreateUserDto {
  email: string;
  password?: string;
  name: string;
  role?: string;
}

export const UserAPI = {
  signup: async (data: CreateUserDto) => {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to sign up');
    }
    
    return response.json();
  },

  login: async (data: Omit<CreateUserDto, 'name' | 'role'>) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to login');
    }
    
    return response.json();
  }
};
