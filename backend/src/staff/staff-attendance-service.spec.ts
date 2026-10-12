import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaffService } from './staff.service';

describe('StaffService - Biometric Attendance & Auto Classification', () => {
  let service: StaffService;
  let mockPrisma: any;
  let mockStaffRecords: any[];
  let mockAttendanceRecords: any[];

  beforeEach(() => {
    mockStaffRecords = [
      { id: 'staff-1', staffCode: 'STF-001', name: 'K. Ramalingam', role: 'Gate Security Guard', status: 'Active' },
      { id: 'staff-2', staffCode: 'STF-002', name: 'Selvi Meenakshi', role: 'Hostel Warden', status: 'Active' },
    ];
    mockAttendanceRecords = [];

    mockPrisma = {
      staff: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id) return mockStaffRecords.find(s => s.id === where.id) || null;
          if (where.staffCode) return mockStaffRecords.find(s => s.staffCode === where.staffCode) || null;
          return null;
        }),
        findMany: vi.fn(async () => mockStaffRecords),
      },
      staffAttendance: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.staffId_dateStr) {
            return mockAttendanceRecords.find(
              a => a.staffId === where.staffId_dateStr.staffId && a.dateStr === where.staffId_dateStr.dateStr
            ) || null;
          }
          return null;
        }),
        create: vi.fn(async ({ data }) => {
          const created = { id: `att-${mockAttendanceRecords.length + 1}`, ...data };
          mockAttendanceRecords.push(created);
          return created;
        }),
        update: vi.fn(async ({ where, data }) => {
          const index = mockAttendanceRecords.findIndex(a => a.id === where.id);
          if (index !== -1) {
            mockAttendanceRecords[index] = { ...mockAttendanceRecords[index], ...data };
            return mockAttendanceRecords[index];
          }
          return { id: where.id, ...data };
        }),
        findMany: vi.fn(async () => mockAttendanceRecords),
      }
    };

    service = new StaffService(mockPrisma);
  });

  it('1. First punch records check-in and keeps status as Present (Pending out)', async () => {
    const result = await service.recordBiometricPunch({
      staffCode: 'STF-001',
      dateStr: '2026-10-12',
      timeStr: '09:00 AM',
      type: 'AUTO'
    });

    expect(result.checkInTime).toBe('09:00 AM');
    expect(result.checkOutTime).toBeNull();
    expect(result.status).toBe('Present');
    expect(result.classification).toBe('PENDING');
    expect(result.workDuration).toBe('On Duty');
  });

  it('2. Second punch (Check-out) after 8.5 hours auto-classifies as Full Day (Present)', async () => {
    // Check-in punch
    await service.recordBiometricPunch({
      staffCode: 'STF-001',
      dateStr: '2026-10-12',
      timeStr: '09:00 AM',
      type: 'AUTO'
    });

    // Check-out punch at 05:30 PM (8h 30m)
    const result = await service.recordBiometricPunch({
      staffCode: 'STF-001',
      dateStr: '2026-10-12',
      timeStr: '05:30 PM',
      type: 'AUTO'
    });

    expect(result.checkInTime).toBe('09:00 AM');
    expect(result.checkOutTime).toBe('05:30 PM');
    expect(result.status).toBe('Present');
    expect(result.classification).toBe('FULL_DAY');
    expect(result.workDuration).toBe('8h 30m');
    expect(result.durationMinutes).toBe(510);
  });

  it('3. Check-out punch after 5 hours auto-classifies as Half Day', async () => {
    // Check-in punch
    await service.recordBiometricPunch({
      staffCode: 'STF-002',
      dateStr: '2026-10-12',
      timeStr: '09:00 AM',
      type: 'AUTO'
    });

    // Check-out punch at 02:00 PM (5 hours)
    const result = await service.recordBiometricPunch({
      staffCode: 'STF-002',
      dateStr: '2026-10-12',
      timeStr: '02:00 PM',
      type: 'AUTO'
    });

    expect(result.status).toBe('Half Day');
    expect(result.classification).toBe('HALF_DAY');
    expect(result.workDuration).toBe('5h');
    expect(result.durationMinutes).toBe(300);
  });

  it('4. Repeated punch within debounce interval (e.g. 1 min) is safely ignored (Idempotency)', async () => {
    // Initial check-in
    await service.recordBiometricPunch({
      staffCode: 'STF-001',
      dateStr: '2026-10-12',
      timeStr: '09:00 AM',
      type: 'IN'
    });

    // Immediate duplicate check-in punch (e.g. at 09:01 AM)
    const duplicateResult = await service.recordBiometricPunch({
      staffCode: 'STF-001',
      dateStr: '2026-10-12',
      timeStr: '09:01 AM',
      type: 'IN'
    });

    expect(duplicateResult.isDuplicateIgnored).toBe(true);
    expect(duplicateResult.checkInTime).toBe('09:00 AM');
  });

  it('5. Manual override: if record was set to On Leave, auto-detect does not overwrite it', async () => {
    // Manually marked On Leave
    await service.saveAttendance({
      staffId: 'staff-1',
      dateStr: '2026-10-12',
      checkInTime: '09:00 AM',
      checkOutTime: '05:00 PM',
      status: 'On Leave'
    });

    // Device punch comes in
    const punchResult = await service.recordBiometricPunch({
      staffCode: 'STF-001',
      dateStr: '2026-10-12',
      timeStr: '05:30 PM',
      type: 'OUT'
    });

    expect(punchResult.status).toBe('On Leave');
  });
});
