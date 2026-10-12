/**
 * Staff Attendance & Working Hours Calculator
 *
 * Rules:
 * - Full Day: >= 8 hours (480 minutes)
 * - Half Day: >= 4 hours (240 minutes) and < 8 hours (480 minutes)
 * - Insufficient: < 4 hours (240 minutes) -> Classified as Absent / Insufficient
 * - Pending: Only check-in recorded, awaiting check-out
 */

export const ATTENDANCE_RULES = {
  FULL_DAY_MINUTES: 480, // 8 hours
  HALF_DAY_MINUTES: 240, // 4 hours
  DEBOUNCE_MINUTES: 2,   // Ignore repeated biometric scans within 2 minutes
};

export type AttendanceClassification = 'FULL_DAY' | 'HALF_DAY' | 'INSUFFICIENT' | 'PENDING' | 'NOT_MARKED';

/**
 * Parses time string in various formats to minutes from midnight (0 - 1439).
 * Supports:
 * - 12-hour format: "09:00 AM", "05:30 PM", "9:15 am"
 * - 24-hour format: "09:00", "17:30", "09:00:00", "17:30:00"
 * - ISO string: "2026-10-12T09:00:00.000Z"
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const s = timeStr.trim();
  if (s === '' || s === '--:--') return null;

  // ISO date string
  if (s.includes('T') || (s.includes('-') && s.length >= 10)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  // 12-hour AM/PM format (e.g. "09:15 AM", "9:00 PM")
  const match12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (hours === 12 && meridiem === 'AM') hours = 0;
    else if (hours < 12 && meridiem === 'PM') hours += 12;
    return hours * 60 + minutes;
  }

  // 24-hour format (e.g. "09:15", "17:30", "17:30:00")
  const match24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

/**
 * Calculates total worked duration in minutes between check-in and check-out.
 * Safely handles overnight shifts where check-out minutes < check-in minutes.
 */
export function calculateWorkingMinutes(checkInStr?: string | null, checkOutStr?: string | null): number | null {
  const inMin = parseTimeToMinutes(checkInStr);
  const outMin = parseTimeToMinutes(checkOutStr);

  if (inMin === null || outMin === null) {
    return null;
  }

  // Same timestamp or invalid sequence
  if (outMin === inMin) {
    return 0;
  }

  if (outMin >= inMin) {
    return outMin - inMin;
  }

  // Overnight shift (e.g. check-in at 10:00 PM (1320), check-out at 06:00 AM (360))
  return (1440 - inMin) + outMin;
}

/**
 * Formats duration in minutes to human-readable string (e.g. "8h 15m", "4h 0m")
 */
export function formatWorkingDuration(minutes: number | null): string {
  if (minutes === null || isNaN(minutes) || minutes < 0) {
    return '--';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Automatically classifies attendance based on working duration and manual override rules.
 */
export function classifyAttendance(params: {
  checkInTime?: string | null;
  checkOutTime?: string | null;
  currentStatus?: string | null;
  isManualOverride?: boolean;
}): {
  status: string;
  classification: AttendanceClassification;
  durationMinutes: number | null;
  workDuration: string;
} {
  const { checkInTime, checkOutTime, currentStatus, isManualOverride } = params;

  // If manually marked "On Leave" or "Absent", preserve user manual override
  if (isManualOverride && (currentStatus === 'On Leave' || currentStatus === 'Absent')) {
    const duration = calculateWorkingMinutes(checkInTime, checkOutTime);
    return {
      status: currentStatus,
      classification: currentStatus === 'On Leave' ? 'NOT_MARKED' : 'INSUFFICIENT',
      durationMinutes: duration,
      workDuration: formatWorkingDuration(duration)
    };
  }

  const duration = calculateWorkingMinutes(checkInTime, checkOutTime);

  // If neither or only check-in exists
  if (duration === null) {
    if (checkInTime && checkInTime !== '--:--') {
      return {
        status: 'Present',
        classification: 'PENDING',
        durationMinutes: null,
        workDuration: 'On Duty'
      };
    }
    return {
      status: currentStatus || 'Not Marked',
      classification: 'NOT_MARKED',
      durationMinutes: null,
      workDuration: '--'
    };
  }

  // Duration calculated
  if (duration >= ATTENDANCE_RULES.FULL_DAY_MINUTES) {
    return {
      status: 'Present',
      classification: 'FULL_DAY',
      durationMinutes: duration,
      workDuration: formatWorkingDuration(duration)
    };
  }

  if (duration >= ATTENDANCE_RULES.HALF_DAY_MINUTES) {
    return {
      status: 'Half Day',
      classification: 'HALF_DAY',
      durationMinutes: duration,
      workDuration: formatWorkingDuration(duration)
    };
  }

  // Less than 4 hours: Insufficient hours
  return {
    status: 'Absent',
    classification: 'INSUFFICIENT',
    durationMinutes: duration,
    workDuration: formatWorkingDuration(duration)
  };
}
