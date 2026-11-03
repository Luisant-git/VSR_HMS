import { describe, expect, it, vi } from 'vitest';
import { EbBillsService } from './eb-bills.service';

describe('EbBillsService', () => {
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
