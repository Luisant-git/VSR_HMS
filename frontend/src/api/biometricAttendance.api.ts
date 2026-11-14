const API_URL = import.meta.env.VITE_API_URL;

const getHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.message || `Request failed with status ${res.status}`);
  }
  return res.json();
};

const queryString = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

const get = <T>(path: string, params: Record<string, unknown> = {}) =>
  fetch(`${API_URL}${path}${queryString(params)}`, { headers: getHeaders() }).then((res) =>
    handleResponse<T>(res),
  );

export interface BioEnvelope {
  available: boolean;
  message: string | null;
  generatedAt: string;
}

export interface BioPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PunchRow {
  id: string;
  punch_date: string;
  punch_time: string;
  time_of_punch: string;
  user_pin: string;
  direction: 'IN' | 'OUT';
  reg_no: string;
  student_name: string;
  room_no: string | null;
  bed_no: string | null;
  student_mobile: string | null;
  verified_by: string | null;
  gate_name: string | null;
  device_id: string | null;
}

export interface DashboardResponse extends BioEnvelope {
  date: string;
  stats: {
    totalStudents: number;
    presentToday: number;
    absentToday: number;
    inside: number;
    outside: number;
    punchesToday: number;
    inToday: number;
    outToday: number;
    lateEntries: number;
    attendanceRate: number;
  };
  recentPunches: PunchRow[];
  weeklyTrend: Array<{ date: string; present: number; punches: number }>;
  deviceSummary: DeviceSummary;
}

export interface PunchLogsResponse extends BioEnvelope {
  data: PunchRow[];
  summary: { total: number; inCount: number; outCount: number; students: number };
  pagination: BioPagination;
}

export interface InsideResponse extends BioEnvelope {
  data: Array<{
    reg_no: string;
    student_name: string;
    room_no: string | null;
    bed_no: string | null;
    in_time_formatted: string;
    student_mobile: string | null;
    in_time: string;
  }>;
  summary: { total: number };
  pagination: BioPagination;
}

export interface OutsideRow {
  reg_no: string;
  student_name: string;
  room_no: string | null;
  bed_no: string | null;
  out_time_formatted: string;
  hours_outside: number;
  time_away: string;
  student_mobile: string | null;
  father_name: string | null;
  father_mobile: string | null;
  out_time: string;
}

export interface OutsideResponse extends BioEnvelope {
  data: OutsideRow[];
  summary: { total: number; over4Hours: number; avgHours: number };
  pagination: BioPagination;
}

export interface DailyRow {
  attendance_date: string;
  reg_no: string;
  student_name: string;
  room_no: string | null;
  bed_no: string | null;
  first_in_time: string | null;
  last_out_time: string | null;
  total_punches: number;
  in_count: number;
  out_count: number;
  span_hours: number;
  attendance_status: string;
}

export interface DailyResponse extends BioEnvelope {
  data: DailyRow[];
  summary: {
    totalStudents: number;
    present: number;
    absent: number;
    totalPunches: number;
    attendanceRate: number;
  };
  pagination: BioPagination;
  date: string;
}

export interface AbsenteeRow {
  check_date: string;
  reg_no: string;
  student_name: string;
  room_no: string | null;
  bed_no: string | null;
  student_mobile: string | null;
  father_name: string | null;
  father_mobile: string | null;
  attendance_status: string;
}

export interface AbsenteeResponse extends BioEnvelope {
  data: AbsenteeRow[];
  summary: { totalStudents: number; absent: number; present: number; attendanceRate: number };
  pagination: BioPagination;
  date: string;
}

export interface CurfewRow {
  violation_date: string;
  entry_time: string;
  punch_time: string;
  reg_no: string;
  student_name: string;
  room_no: string | null;
  mins_late: number;
  student_mobile: string | null;
  father_name: string | null;
  father_mobile: string | null;
}

export interface CurfewResponse extends BioEnvelope {
  data: CurfewRow[];
  summary: {
    totalViolations: number;
    students: number;
    avgMinutesLate: number;
    maxMinutesLate: number;
  };
  pagination: BioPagination;
  fromDate: string;
  toDate: string;
  curfewTime: string;
}

export interface FrequentCurfewRow {
  reg_no: string;
  student_name: string;
  room_no: string | null;
  total_late_entries: number;
  avg_minutes_late: number;
  father_mobile: string | null;
  student_mobile?: string | null;
}

export interface FrequentCurfewResponse extends BioEnvelope {
  data: FrequentCurfewRow[];
  summary: { total: number; days: number; minCount: number };
}

export interface RoomWiseRow {
  report_date: string;
  room_no: string;
  block: string | null;
  floor: number | null;
  total_allotted_students: number;
  present_count: number;
  absent_count: number;
  room_status: string;
  attendance_rate: number;
}

export interface FloorSummaryRow {
  floor: string;
  rooms: number;
  totalStudents: number;
  present: number;
  absent: number;
  attendanceRate: number;
}

export interface RoomWiseResponse extends BioEnvelope {
  data: RoomWiseRow[];
  summary: {
    rooms: number;
    totalStudents: number;
    present: number;
    absent: number;
    fullRooms: number;
    attendanceRate: number;
  };
  floorSummary: FloorSummaryRow[];
  date: string;
}

export interface MonthlyRow {
  reg_no: string;
  student_name: string;
  room_no: string | null;
  days_present: number;
  total_punches: number;
  total_in_count: number;
  total_out_count: number;
  attendance_percent: number;
  low_attendance: boolean;
}

export interface MonthlyResponse extends BioEnvelope {
  data: MonthlyRow[];
  summary: {
    students: number;
    avgDaysPresent: number;
    totalPunches: number;
    lowAttendance: number;
    rangeDays: number;
    fromDate: string;
    toDate: string;
    lowThreshold: number;
  };
  pagination: BioPagination;
  month: string;
  fromDate: string;
  toDate: string;
}

export interface BioStudent {
  id: string;
  reg_no: string;
  name: string;
  room_no: string | null;
  bed_no: string | null;
  biometric_id: string | null;
  student_mobile?: string | null;
  father_name?: string | null;
  father_mobile?: string | null;
  status?: string;
}

export interface StudentPunchRow {
  punch_date: string;
  punch_time: string;
  punch_time_raw: string;
  direction: 'IN' | 'OUT';
  method: string | null;
  device_id: string | null;
  terminal_name: string | null;
  synced_at: string | null;
}

export interface StudentPunchesResponse extends BioEnvelope {
  student: BioStudent;
  data: StudentPunchRow[];
  summary: {
    totalPunches: number;
    days: number;
    inCount: number;
    outCount: number;
    firstPunch: string | null;
    lastPunch: string | null;
  };
  pagination: BioPagination;
}

export interface BioDevice {
  device_id: string;
  device_name: string;
  ip_address: string | null;
  is_online: boolean;
  serial_number: string | null;
  firmware_version: string | null;
  face_version: string | null;
  platform: string | null;
  punches_in_ram: number;
  last_online_at: string | null;
  updated_at: string | null;
  last_synced_timestamp: string | null;
  last_synced_uid: string | null;
  total_synced_records: number;
  records_in_last_batch: number;
  last_sync_status: string | null;
  last_successful_sync: string | null;
  last_error_message: string | null;
}

export interface DeviceSummary {
  total: number;
  online: number;
  offline: number;
  totalRecords: number;
  syncErrors: number;
  lastSuccessfulSync: string | null;
}

export interface DevicesResponse extends BioEnvelope {
  data: BioDevice[];
  summary: DeviceSummary;
}

export interface HealthResponse {
  available: boolean;
  ready: boolean;
  checkedAt: string;
  missing: string[];
  objects: Record<string, boolean>;
  totalStudents: number;
  message: string;
}

export const BiometricAttendanceAPI = {
  health: () => get<HealthResponse>('/biometric-attendance/health'),
  dashboard: () => get<DashboardResponse>('/biometric-attendance/dashboard'),
  punchLogs: (params: Record<string, unknown>) =>
    get<PunchLogsResponse>('/biometric-attendance/punch-logs', params),
  currentlyInside: (params: Record<string, unknown>) =>
    get<InsideResponse>('/biometric-attendance/currently-inside', params),
  currentlyOutside: (params: Record<string, unknown>) =>
    get<OutsideResponse>('/biometric-attendance/currently-outside', params),
  daily: (params: Record<string, unknown>) =>
    get<DailyResponse>('/biometric-attendance/daily', params),
  absentees: (params: Record<string, unknown>) =>
    get<AbsenteeResponse>('/biometric-attendance/absentees', params),
  curfew: (params: Record<string, unknown>) =>
    get<CurfewResponse>('/biometric-attendance/curfew', params),
  frequentCurfew: (params: Record<string, unknown>) =>
    get<FrequentCurfewResponse>('/biometric-attendance/curfew/frequent', params),
  roomWise: (params: Record<string, unknown>) =>
    get<RoomWiseResponse>('/biometric-attendance/room-wise', params),
  monthly: (params: Record<string, unknown>) =>
    get<MonthlyResponse>('/biometric-attendance/monthly', params),
  students: (params: Record<string, unknown>) =>
    get<{ data: BioStudent[]; error: string | null }>('/biometric-attendance/students', params),
  studentPunches: (identifier: string, params: Record<string, unknown>) =>
    get<StudentPunchesResponse>(
      `/biometric-attendance/students/${encodeURIComponent(identifier)}/punches`,
      params,
    ),
  devices: () => get<DevicesResponse>('/biometric-attendance/devices'),
};
