import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  calculateWorkingMinutes,
  formatWorkingDuration,
  classifyAttendance,
  ATTENDANCE_RULES,
} from './staff-attendance-calculator';

describe('Staff Attendance Calculator & Classification Tests', () => {
  describe('parseTimeToMinutes', () => {
    it('should parse 12-hour AM/PM formats correctly', () => {
      expect(parseTimeToMinutes('09:00 AM')).toBe(540);
      expect(parseTimeToMinutes('12:00 PM')).toBe(720);
      expect(parseTimeToMinutes('12:30 AM')).toBe(30);
      expect(parseTimeToMinutes('05:30 PM')).toBe(1050);
      expect(parseTimeToMinutes('11:59 PM')).toBe(1439);
    });

    it('should parse 24-hour formats correctly', () => {
      expect(parseTimeToMinutes('09:00')).toBe(540);
      expect(parseTimeToMinutes('17:30')).toBe(1050);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('23:59:00')).toBe(1439);
    });

    it('should handle invalid or empty time strings safely', () => {
      expect(parseTimeToMinutes('')).toBeNull();
      expect(parseTimeToMinutes('--:--')).toBeNull();
      expect(parseTimeToMinutes(null)).toBeNull();
      expect(parseTimeToMinutes(undefined)).toBeNull();
      expect(parseTimeToMinutes('invalid-string')).toBeNull();
    });
  });

  describe('calculateWorkingMinutes', () => {
    it('should calculate duration correctly for same-day shifts', () => {
      // 09:00 AM (540) to 05:30 PM (1050) = 510 minutes (8h 30m)
      expect(calculateWorkingMinutes('09:00 AM', '05:30 PM')).toBe(510);
      // 09:00 AM (540) to 01:00 PM (780) = 240 minutes (4h 0m)
      expect(calculateWorkingMinutes('09:00 AM', '01:00 PM')).toBe(240);
    });

    it('should handle overnight shifts crossing midnight', () => {
      // 10:00 PM (1320) to 06:00 AM (360) = (1440 - 1320) + 360 = 480 minutes (8h 0m)
      expect(calculateWorkingMinutes('10:00 PM', '06:00 AM')).toBe(480);
    });

    it('should return 0 if check-in and check-out are identical', () => {
      expect(calculateWorkingMinutes('09:00 AM', '09:00 AM')).toBe(0);
    });

    it('should return null if either timestamp is missing', () => {
      expect(calculateWorkingMinutes('09:00 AM', null)).toBeNull();
      expect(calculateWorkingMinutes(null, '05:30 PM')).toBeNull();
      expect(calculateWorkingMinutes('--:--', '--:--')).toBeNull();
    });
  });

  describe('formatWorkingDuration', () => {
    it('should format minutes to human-readable strings', () => {
      expect(formatWorkingDuration(510)).toBe('8h 30m');
      expect(formatWorkingDuration(480)).toBe('8h');
      expect(formatWorkingDuration(45)).toBe('45m');
      expect(formatWorkingDuration(null)).toBe('--');
      expect(formatWorkingDuration(-10)).toBe('--');
    });
  });

  describe('classifyAttendance (Full Day, Half Day, Insufficient, Overrides)', () => {
    it('Scenario 1: Staff works >= 8 hours -> Full Day (Present)', () => {
      const res = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: '05:30 PM', // 8h 30m = 510 minutes
      });
      expect(res.status).toBe('Present');
      expect(res.classification).toBe('FULL_DAY');
      expect(res.durationMinutes).toBe(510);
      expect(res.workDuration).toBe('8h 30m');
    });

    it('Scenario 1b: Staff works exactly 8 hours -> Full Day', () => {
      const res = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: '05:00 PM', // 480 minutes
      });
      expect(res.status).toBe('Present');
      expect(res.classification).toBe('FULL_DAY');
      expect(res.durationMinutes).toBe(480);
      expect(res.workDuration).toBe('8h');
    });

    it('Scenario 2: Staff works >= 4 hours and < 8 hours -> Half Day', () => {
      const res = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: '01:30 PM', // 4h 30m = 270 minutes
      });
      expect(res.status).toBe('Half Day');
      expect(res.classification).toBe('HALF_DAY');
      expect(res.durationMinutes).toBe(270);
      expect(res.workDuration).toBe('4h 30m');
    });

    it('Scenario 3: Staff checks in but has not checked out -> Pending / On Duty', () => {
      const res = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: null,
      });
      expect(res.status).toBe('Present');
      expect(res.classification).toBe('PENDING');
      expect(res.durationMinutes).toBeNull();
      expect(res.workDuration).toBe('On Duty');
    });

    it('Scenario 5: Staff checks out earlier than expected (< 4 hours) -> Insufficient / Absent', () => {
      const res = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: '11:30 AM', // 2h 30m = 150 minutes
      });
      expect(res.status).toBe('Absent');
      expect(res.classification).toBe('INSUFFICIENT');
      expect(res.durationMinutes).toBe(150);
      expect(res.workDuration).toBe('2h 30m');
    });

    it('Scenario 6: Missing or invalid timestamps handled safely without crashing', () => {
      const res = classifyAttendance({
        checkInTime: '--:--',
        checkOutTime: '--:--',
      });
      expect(res.status).toBe('Not Marked');
      expect(res.classification).toBe('NOT_MARKED');
      expect(res.durationMinutes).toBeNull();
      expect(res.workDuration).toBe('--');
    });

    it('Scenario 7: Manual overrides for "On Leave" and "Absent" are respected', () => {
      const resLeave = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: '05:00 PM',
        currentStatus: 'On Leave',
        isManualOverride: true,
      });
      expect(resLeave.status).toBe('On Leave');

      const resAbsent = classifyAttendance({
        checkInTime: '09:00 AM',
        checkOutTime: '05:00 PM',
        currentStatus: 'Absent',
        isManualOverride: true,
      });
      expect(resAbsent.status).toBe('Absent');
    });
  });
});
