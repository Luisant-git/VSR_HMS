const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface WhatsAppStatusResponse {
  connected: boolean;
  isConnecting?: boolean;
  qr?: string | null;
  qrGeneratedAt?: string | null;
  phone?: string | null;
  name?: string | null;
  updatedAt?: string;
}

export const checkWhatsAppStatus = async (): Promise<{ connected: boolean }> => {
  try {
    const res = await fetch(`${BASE_URL}/whatsapp/status`, { headers: getHeaders() });
    if (!res.ok) return { connected: false };
    return await res.json();
  } catch {
    return { connected: false };
  }
};

export const getWhatsAppStatus = async (): Promise<WhatsAppStatusResponse> => {
  try {
    const res = await fetch(`${BASE_URL}/whatsapp/status`, { headers: getHeaders() });
    if (!res.ok) return { connected: false, isConnecting: false };
    return await res.json();
  } catch {
    return { connected: false, isConnecting: false };
  }
};

export const reconnectWhatsApp = async (): Promise<WhatsAppStatusResponse> => {
  const res = await fetch(`${BASE_URL}/whatsapp/reconnect`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reconnect WhatsApp service');
  return await res.json();
};

export const logoutWhatsApp = async (): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${BASE_URL}/whatsapp/logout`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to disconnect WhatsApp service');
  return await res.json();
};

export const sendWhatsAppReceipt = async (
  phone: string,
  data: any,
): Promise<{ success: boolean }> => {
  const res = await fetch(`${BASE_URL}/whatsapp/send-receipt`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ phone, data }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || 'Failed to send WhatsApp receipt');
  }

  return await res.json();
};

export const sendWhatsAppPdf = async (
  phone: string,
  pdfBase64: string,
  fileName: string,
  caption?: string,
): Promise<{ success: boolean }> => {
  const res = await fetch(`${BASE_URL}/whatsapp/send-pdf`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ phone, pdfBase64, fileName, caption }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || 'Failed to send PDF receipt on WhatsApp');
  }

  return await res.json();
};

export const sendStudentWhatsAppIdCard = async (
  phone: string,
  student: any,
): Promise<{ success: boolean }> => {
  const res = await fetch(`${BASE_URL}/whatsapp/send-student-id-card`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ phone, student }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || 'Failed to send WhatsApp ID card');
  }

  return await res.json();
};
