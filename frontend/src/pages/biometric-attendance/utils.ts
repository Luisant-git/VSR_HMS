import * as XLSX from 'xlsx';
import { formatDateDMY } from '../../utils/date';

export const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const currentMonthInput = () => todayInput().slice(0, 7);

export const daysBetween = (fromDate: string, toDate: string) => {
  if (!fromDate || !toDate) return 0;
  const from = new Date(`${fromDate}T00:00:00`).getTime();
  const to = new Date(`${toDate}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
};

export const monthBounds = (month: string) => {
  const safe = /^\d{4}-\d{2}$/.test(month) ? month : currentMonthInput();
  const end = new Date(Number(safe.slice(0, 4)), Number(safe.slice(5, 7)), 0);
  return {
    fromDate: `${safe}-01`,
    toDate: `${safe}-${String(end.getDate()).padStart(2, '0')}`,
  };
};

export const formatDate = (value?: string | null) => (value ? formatDateDMY(value) || value : '—');

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${day}/${month}/${year}, ${time}`;
};

export const formatTime = (value?: string | null) => {
  if (!value) return '—';
  if (/^\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)$/i.test(value.trim())) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const durationLabel = (hours: number) => {
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const whole = Math.floor(safe);
  const minutes = Math.round((safe - whole) * 60);
  if (whole === 0 && minutes === 0) return 'Just now';
  return `${whole}h ${minutes.toString().padStart(2, '0')}m`;
};

export const hoursSince = (value?: string | null) => {
  if (!value) return 0;
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return 0;
  return Math.max(0, (Date.now() - at) / 3_600_000);
};

export const percent = (value: unknown) => `${Math.round(number(value) * 10) / 10}%`;

export const initials = (name?: string | null) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export type ExportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export const exportExcel = (sheets: ExportSheet[], filename: string) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    const widths = Object.keys(sheet.rows[0] || {}).map((key) => {
      const longest = sheet.rows.reduce(
        (max, row) => Math.max(max, String(row[key] ?? '').length),
        key.length,
      );
      return { wch: Math.min(42, Math.max(10, longest + 2)) };
    });
    worksheet['!cols'] = widths;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });
  XLSX.writeFile(workbook, filename);
};

export const downloadStamp = () => todayInput().replace(/-/g, '_');
