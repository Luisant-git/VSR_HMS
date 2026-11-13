import { describe, it, expect } from 'vitest';
import { FeesService } from './fees.service';

type FeeRow = {
  id: string;
  studentId: string;
  transactionType: string;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date;
  paidDate?: Date | null;
};

const makeFee = (overrides: Partial<FeeRow> = {}): FeeRow => ({
  id: overrides.id ?? 'fee-1',
  studentId: overrides.studentId ?? 'student-1',
  transactionType: overrides.transactionType ?? 'RENT',
  amount: overrides.amount ?? 5000,
  description: overrides.description ?? 'Room Rent for November 2026',
  status: overrides.status ?? 'PENDING',
  createdAt: overrides.createdAt ?? new Date('2026-11-05T00:00:00'),
  paidDate: overrides.paidDate ?? null,
});

const students = [
  {
    id: 'student-1',
    regNo: 'HST-001',
    manualRegsiName: 'ALICE',
    name: 'Alice',
    roomNo: '101',
  },
];

const createPrismaFake = (initialRows: FeeRow[]) => {
  const rows = initialRows.map(row => ({ ...row }));

  const feeTransaction = {
    findMany: async ({ where }: any = {}) => {
      let result = rows.filter(row => {
        if (where?.studentId && row.studentId !== where.studentId) return false;
        if (where?.status && row.status !== where.status) return false;
        return true;
      });
      result = result.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      return result.map(row => ({ ...row }));
    },
    create: async ({ data }: any) => {
      const created = makeFee({ ...data, id: data.id ?? `fee-${rows.length + 1}` });
      rows.push(created);
      return { ...created };
    },
    update: async ({ where, data }: any) => {
      const index = rows.findIndex(row => row.id === where.id);
      if (index === -1) throw new Error('Row not found');
      rows[index] = { ...rows[index], ...data };
      return { ...rows[index] };
    },
    delete: async ({ where }: any) => {
      const index = rows.findIndex(row => row.id === where.id);
      if (index === -1) throw new Error('Row not found');
      const [removed] = rows.splice(index, 1);
      return { ...removed };
    },
  };

  const tx = { feeTransaction };

  const prisma = {
    student: {
      findFirst: async ({ where }: any) => {
        const conditions = where?.OR ?? [];
        for (const condition of conditions) {
          const [field, filter] = Object.entries(condition)[0] as [
            string,
            { equals: string },
          ];
          const match = students.find(student => {
            const value = (student as any)[field];
            return (
              typeof value === 'string' &&
              value.toLowerCase() === String(filter.equals).toLowerCase()
            );
          });
          if (match) return { ...match };
        }
        return null;
      },
    },
    $transaction: async (callback: any) => callback(tx),
    __rows: rows,
  };

  return prisma;
};

const createService = (rows: FeeRow[]) => {
  const prisma = createPrismaFake(rows);
  return { prisma, service: new FeesService(prisma as any) };
};

describe('FeesService.importFeeEdits', () => {
  it('updates the newest pending row when the Excel amount is increased', async () => {
    const { prisma, service } = createService([makeFee({ amount: 5000 })]);

    const result = await service.importFeeEdits({
      rows: [{ studentKey: 'HST-001', rent: 6000 }],
    });

    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.__rows[0].amount).toBe(6000);
    expect(result.changes[0].items[0]).toMatchObject({
      category: 'rent',
      from: 5000,
      to: 6000,
      delta: 1000,
    });
  });

  it('keeps split rows and only adjusts the delta', async () => {
    const { prisma, service } = createService([
      makeFee({ id: 'rent-1', amount: 2500 }),
      makeFee({
        id: 'rent-2',
        amount: 2500,
        createdAt: new Date('2026-11-06T00:00:00'),
      }),
    ]);

    await service.importFeeEdits({
      rows: [{ studentKey: 'alice', rent: 6000 }],
    });

    expect(prisma.__rows.find(row => row.id === 'rent-1')?.amount).toBe(2500);
    expect(prisma.__rows.find(row => row.id === 'rent-2')?.amount).toBe(3500);
    expect(prisma.__rows.reduce((sum, row) => sum + row.amount, 0)).toBe(6000);
  });

  it('does not write anything during a dry run', async () => {
    const { prisma, service } = createService([makeFee({ amount: 5000 })]);

    const result = await service.importFeeEdits({
      rows: [{ studentKey: 'HST-001', rent: 6000 }],
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.updated).toBe(1);
    expect(prisma.__rows[0].amount).toBe(5000);
  });

  it('creates a pending row when the category has no current due', async () => {
    const { prisma, service } = createService([makeFee({ amount: 5000 })]);

    await service.importFeeEdits({
      rows: [{ studentKey: 'HST-001', fine: 500 }],
    });

    const fine = prisma.__rows.find(row => row.transactionType === 'FINE');
    expect(fine).toBeDefined();
    expect(fine?.amount).toBe(500);
    expect(fine?.status).toBe('PENDING');
  });

  it('removes a current due when the Excel amount is set to zero', async () => {
    const { prisma, service } = createService([makeFee({ amount: 5000 })]);

    await service.importFeeEdits({
      rows: [{ studentKey: 'HST-001', rent: 0 }],
    });

    expect(prisma.__rows).toHaveLength(0);
  });

  it('never edits outstanding, imported, mess or paid rows', async () => {
    const { prisma, service } = createService([
      makeFee({ id: 'current', amount: 5000 }),
      makeFee({
        id: 'outstanding',
        amount: 3000,
        description: 'Outstanding Rent for Sep 2026',
      }),
      makeFee({
        id: 'imported',
        amount: 2000,
        description: 'October 2026 Rent',
      }),
      makeFee({
        id: 'mess',
        amount: 1500,
        transactionType: 'MESS',
        description: 'Mess November 2026',
      }),
      makeFee({
        id: 'paid',
        amount: 4000,
        status: 'COMPLETED',
        description: 'Room Rent for November 2026',
      }),
    ]);

    const result = await service.importFeeEdits({
      rows: [{ studentKey: 'HST-001', rent: 6000 }],
    });

    expect(result.changes[0].items[0].from).toBe(5000);
    expect(prisma.__rows.find(row => row.id === 'current')?.amount).toBe(6000);
    expect(prisma.__rows.find(row => row.id === 'outstanding')?.amount).toBe(3000);
    expect(prisma.__rows.find(row => row.id === 'imported')?.amount).toBe(2000);
    expect(prisma.__rows.find(row => row.id === 'mess')?.amount).toBe(1500);
    expect(prisma.__rows.find(row => row.id === 'paid')?.amount).toBe(4000);
  });

  it('reports unknown students without failing the other rows', async () => {
    const { service } = createService([makeFee({ amount: 5000 })]);

    const result = await service.importFeeEdits({
      rows: [
        { studentKey: 'HST-001', rent: 6000 },
        { studentKey: 'UNKNOWN', rent: 6000 },
      ],
    });

    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].studentKey).toBe('UNKNOWN');
  });

  it('rejects negative amounts and duplicate student rows', async () => {
    const { service } = createService([makeFee({ amount: 5000 })]);

    const result = await service.importFeeEdits({
      rows: [
        { studentKey: 'HST-001', rent: -1 },
        { studentKey: 'HST-001', rent: 6000 },
      ],
    });

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(2);
  });
});
