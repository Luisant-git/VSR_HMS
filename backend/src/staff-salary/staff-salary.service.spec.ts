import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaffSalaryService } from './staff-salary.service';

describe('StaffSalaryService Unit Tests', () => {
  let service: StaffSalaryService;
  let mockPrisma: any;
  let mockStaffRecords: any[];
  let mockSalaryRecords: any[];

  beforeEach(() => {
    mockStaffRecords = [
      {
        id: 'staff-1',
        staffCode: 'STF-001',
        name: 'K. Ramalingam',
        role: 'Hostel Warden',
        baseSalary: 35000.0,
        salaryBasis: 'Monthly Fixed',
        status: 'Active'
      },
      {
        id: 'staff-2',
        staffCode: 'STF-002',
        name: 'Selvi Meenakshi',
        role: 'Assistant Warden',
        baseSalary: 22000.0,
        salaryBasis: 'Monthly Fixed',
        status: 'Active'
      }
    ];

    mockSalaryRecords = [];

    mockPrisma = {
      staff: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id) return mockStaffRecords.find(s => s.id === where.id) || null;
          return null;
        }),
      },
      staffSalary: {
        findFirst: vi.fn(async ({ where }) => {
          if (where?.salaryCode?.startsWith) {
            const matches = mockSalaryRecords.filter(r => r.salaryCode.startsWith(where.salaryCode.startsWith));
            return matches[matches.length - 1] || null;
          }
          return null;
        }),
        findMany: vi.fn(async ({ where }) => {
          let res = [...mockSalaryRecords];
          if (where?.month && where.month !== 'ALL') res = res.filter(r => r.month === where.month);
          if (where?.year && where.year !== 'ALL') res = res.filter(r => r.year === where.year);
          if (where?.staffId && where.staffId !== 'ALL') res = res.filter(r => r.staffId === where.staffId);
          return res;
        }),
        findUnique: vi.fn(async ({ where }) => {
          if (where.id) return mockSalaryRecords.find(r => r.id === where.id) || null;
          if (where.staffId_salaryMonth) {
            return mockSalaryRecords.find(
              r => r.staffId === where.staffId_salaryMonth.staffId && r.salaryMonth === where.staffId_salaryMonth.salaryMonth
            ) || null;
          }
          return null;
        }),
        create: vi.fn(async ({ data }) => {
          const created = { id: `sal-${mockSalaryRecords.length + 1}`, ...data };
          mockSalaryRecords.push(created);
          return created;
        }),
        update: vi.fn(async ({ where, data }) => {
          const index = mockSalaryRecords.findIndex(r => r.id === where.id);
          if (index !== -1) {
            mockSalaryRecords[index] = { ...mockSalaryRecords[index], ...data };
            return mockSalaryRecords[index];
          }
          return { id: where.id, ...data };
        }),
        delete: vi.fn(async ({ where }) => {
          const index = mockSalaryRecords.findIndex(r => r.id === where.id);
          if (index !== -1) {
            const deleted = mockSalaryRecords[index];
            mockSalaryRecords.splice(index, 1);
            return deleted;
          }
          return { id: where.id };
        }),
        count: vi.fn(async () => mockSalaryRecords.length),
      }
    };

    service = new StaffSalaryService(mockPrisma);
  });

  it('1. Successfully records a salary disbursement and calculates net amount', async () => {
    const record = await service.create({
      staffId: 'staff-1',
      month: 'October',
      year: 2026,
      baseSalary: 35000,
      bonus: 2000,
      deductions: 500,
      paymentMode: 'Direct Bank Transfer',
      remarks: 'October salary with bonus'
    });

    expect(record).toBeDefined();
    expect(record.salaryCode).toBe('SAL-202610-001');
    expect(record.netAmount).toBe(36500); // 35000 + 2000 - 500
    expect(record.month).toBe('October');
    expect(record.year).toBe(2026);
    expect(record.paymentMode).toBe('Direct Bank Transfer');
  });

  it('2. Prevents duplicate salary disbursements for the same staff member and month', async () => {
    await service.create({
      staffId: 'staff-1',
      month: 'October',
      year: 2026,
      baseSalary: 35000
    });

    await expect(
      service.create({
        staffId: 'staff-1',
        month: 'October',
        year: 2026,
        baseSalary: 35000
      })
    ).rejects.toThrow('Salary has already been disbursed');
  });

  it('3. Updates salary record bonus/deductions and recalculates net amount', async () => {
    const created = await service.create({
      staffId: 'staff-2',
      month: 'September',
      year: 2026,
      baseSalary: 22000,
      bonus: 0,
      deductions: 0
    });

    expect(created.netAmount).toBe(22000);

    const updated = await service.update(created.id, {
      bonus: 1500,
      deductions: 300,
      remarks: 'Updated festival bonus'
    });

    expect(updated.netAmount).toBe(23200); // 22000 + 1500 - 300
    expect(updated.remarks).toBe('Updated festival bonus');
  });

  it('4. Filters salary disbursements by month and calculates summary totals', async () => {
    await service.create({
      staffId: 'staff-1',
      month: 'October',
      year: 2026,
      baseSalary: 35000
    });

    await service.create({
      staffId: 'staff-2',
      month: 'September',
      year: 2026,
      baseSalary: 22000
    });

    const result = await service.findAll({ month: 'October' });
    expect(result.total).toBe(1);
    expect(result.records[0].month).toBe('October');
    expect(result.summary.totalDisbursed).toBe(35000);
  });

  it('5. Successfully deletes a salary record', async () => {
    const created = await service.create({
      staffId: 'staff-1',
      month: 'October',
      year: 2026,
      baseSalary: 35000
    });

    const deleted = await service.remove(created.id);
    expect(deleted.id).toBe(created.id);

    await expect(service.findOne(created.id)).rejects.toThrow('Salary record not found');
  });
});
