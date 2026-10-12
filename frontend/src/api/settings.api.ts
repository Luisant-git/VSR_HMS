const API_URL = `${import.meta.env.VITE_API_URL}/system-settings`;

const getHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const getSystemSettings = async () => {
  const response = await fetch(API_URL, {
    headers: getHeaders()
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to fetch system settings');
  }
  return response.json();
};

export const updateSystemSettings = async (data: any) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || 'Failed to update system settings');
  }
  return response.json();
};
