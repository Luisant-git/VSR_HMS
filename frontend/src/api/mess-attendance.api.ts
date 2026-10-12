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

export interface MessAttendanceReportItem {
  id: string;
  studentId: string;
  mealType: string;
  scannedAt: string;
  date: string;
  student?: {
    id: string;
    name: string;
    regNo: string;
    roomNo?: string;
    foodType?: string;
  };
}

export const MessAttendanceAPI = {
  getTodayAttendance: async (studentId: string) => {
    const response = await fetch(`${API_URL}/mess-attendance/${studentId}/today`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  markAttendance: async (studentId: string, mealType: string) => {
    const response = await fetch(`${API_URL}/mess-attendance/${studentId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mealType })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw { response: { data: { message: errorData?.message || 'Failed to mark attendance' } } };
    }
    return response.json();
  },

  getReports: async (): Promise<MessAttendanceReportItem[]> => {
    const response = await fetch(`${API_URL}/mess-attendance/reports`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  }
};
