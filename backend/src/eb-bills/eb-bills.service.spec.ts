import { describe, expect, it, vi } from 'vitest';
import { EbBillsService } from './eb-bills.service';

describe('EbBillsService', () => {
  it('filters room bill rows by the selected billing cycle', async () => {
    const ebBill = {
      findMany: vi.fn(async () => [{ id: 'bill-1', roomNo: 'WMT', billingCycle: '2026-11' }]),
      count: vi.fn(async () => 1),
    };
    const service = new EbBillsService({ ebBill } as any);

    const result = await service.findAll(1, 10, undefined, undefined, undefined, '2026-11');

    expect(ebBill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { billingCycle: '2026-11' } }),
    );
    expect(ebBill.count).toHaveBeenCalledWith({ where: { billingCycle: '2026-11' } });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].roomNo).toBe('WMT');
  });

  it('returns distinct billing cycles newest first', async () => {
    const ebBill = {
      findMany: vi.fn(async () => [
        { billingCycle: '2026-12' },
        { billingCycle: '2026-11' },
      ]),
    };
    const service = new EbBillsService({ ebBill } as any);

    await expect(service.findBillingCycles()).resolves.toEqual(['2026-12', '2026-11']);
    expect(ebBill.findMany).toHaveBeenCalledWith({
      select: { billingCycle: true },
      distinct: ['billingCycle'],
      orderBy: { billingCycle: 'desc' },
    });
  });

  it('creates missing shares for active students when an existing bill is edited', async () => {
    const activeStudents = [
      { id: 'student-1' },
      { id: 'student-2' },
      { id: 'student-3' },
    ];
    const transactionClient = {
      ebBill: {
        update: vi.fn(async ({ data }) => data),
      },
      feeTransaction: {
        updateMany: vi.fn(),
        findMany: vi.fn(async () => [
          { studentId: 'student-1' },
          { studentId: 'student-2' },
        ]),
        createMany: vi.fn(),
      },
    };
    const prisma = {
      ebBill: {
        findUnique: vi.fn(async () => ({
          id: 'bill-1',
          roomNo: 'WMT',
          billingCycle: '2026-11',
          hasAcMeter: false,
          acPrevReading: 0,
          acCurrReading: 0,
          normalPrevReading: 0,
          normalCurrReading: 100,
          prevReading: 0,
          currReading: 100,
          unitsConsumed: 100,
          tariffRate: 10,
        })),
        findFirst: vi.fn(),
      },
      room: {
        findUnique: vi.fn(async () => ({ students: activeStudents })),
      },
      $transaction: vi.fn(async (callback) => callback(transactionClient)),
    } as any;
    const service = new EbBillsService(prisma);

    await service.update('bill-1', {});

    expect(transactionClient.feeTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: { in: ['student-1', 'student-2', 'student-3'] },
          transactionType: 'EB_BILL',
          status: 'PENDING',
          description: 'EB Bill for 2026-11',
        }),
        data: expect.objectContaining({
          amount: 1000 / 3,
          description: 'EB Bill for 2026-11',
        }),
      }),
    );
    expect(transactionClient.feeTransaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          studentId: 'student-3',
          transactionType: 'EB_BILL',
          amount: 1000 / 3,
          description: 'EB Bill for 2026-11',
          status: 'PENDING',
        }),
      ],
    });
  });
});
