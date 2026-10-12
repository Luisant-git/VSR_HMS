const API_URL = import.meta.env.VITE_API_URL;

const getHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const MessAttendanceAPI = {
  getTodayAttendance: async (studentId: string) => {
    const response = await fetch(`${API_URL}/mess-attendance/${studentId}/today`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to fetch attendance');
    }
    return response.json();
  },

  markAttendance: async (studentId: string, mealType: string) => {
    const response = await fetch(`${API_URL}/mess-attendance/${studentId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mealType })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      // throw an object with response structure to match what UI expects (err.response.data.message)
      throw { response: { data: { message: errorData?.message || 'Failed to mark attendance' } } };
    }
    return response.json();
  }
};
