import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeesService } from './fees.service';

const DUE_DAY_5 = '2000-01-05T00:00:00.000Z';

type Row = Record<string, any>;

function createService(now: Date, transactions: Row[], billingCycle = 'PREPAID') {
  vi.useFakeTimers();
  vi.setSystemTime(now);

  const prisma = {
    student: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'stu-1',
        college: {
          id: 'col-1',
          dueDate: new Date(DUE_DAY_5),
          billingCycle,
          fineMaster: { rentFine: 10, messFine: 10, ebFine: 10 },
        },
        transactions,
      }),
    },
    feeTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const service = new FeesService(prisma as never, { sendFeeReceipt: vi.fn() } as never);
  return { service, prisma };
}

function fee(overrides: Row = {}): Row {
  return {
    id: 'fee-rent',
    studentId: 'stu-1',
    transactionType: 'RENT',
    status: 'PENDING',
    amount: 1000,
    billingMonth: '2026-10',
    description: 'Outstanding Rent for Oct 2026',
    paidDate: null,
    createdAt: new Date(2026, 9, 1),
    ...overrides,
  };
}

function payment(id: string, amount: number, paidDate: Date): Row {
  return {
    id,
    transactionType: 'OUTSTANDING_PAYMENT',
    status: 'COMPLETED',
    amount,
    paidDate,
    description: 'Outstanding payment',
    createdAt: paidDate,
  };
}

async function preview(
  service: FeesService,
  asOfDate: string,
): Promise<Record<string, any>> {
  return (await service.previewFine('stu-1', asOfDate)) as Record<string, any>;
}

const byKey = (result: Record<string, any>) =>
  Object.fromEntries(
    (result.fines as Row[]).map((entry: Row) => [entry.key, entry]),
  );

describe('production fine scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1a. PREPAID October fee paid on Nov 5: 31 fine days, and accrual stops', async () => {
    const rows = [
      fee({
        description: 'Outstanding Rent for Oct 2026 | Pending Balance: 0',
        status: 'COMPLETED',
        paidDate: new Date(2026, 10, 5),
      }),
    ];
    const { service } = createService(new Date(2026, 10, 24, 12), rows);

    const onPaymentDate = await preview(service, '2026-11-05');
    expect(byKey(onPaymentDate).rent.daysOverdue).toBe(31); // Oct 6 - Nov 5

    const later = await preview(service, '2026-11-24');
    expect(byKey(later).rent.daysOverdue).toBe(31); // must not grow to 50
  });

  it('1b. POSTPAID October fee paid on Nov 5: 0 fine days', async () => {
    const rows = [
      fee({
        description: 'Outstanding Rent for Oct 2026 | Pending Balance: 0',
        status: 'COMPLETED',
        paidDate: new Date(2026, 10, 5),
      }),
    ];
    const { service } = createService(new Date(2026, 10, 24, 12), rows, 'POSTPAID');

    const later = await preview(service, '2026-11-24');
    expect(byKey(later).rent.daysOverdue).toBe(0); // due Nov 5, paid on due day
  });

  it('2a. PREPAID November fee starts on Nov 6', async () => {
    const rows = [fee({ billingMonth: '2026-11', description: 'Room Rent for Nov 2026' })];
    const { service } = createService(new Date(2026, 10, 24, 12), rows);

    expect(byKey(await preview(service, '2026-11-05')).rent.daysOverdue).toBe(0);
    expect(byKey(await preview(service, '2026-11-06')).rent.daysOverdue).toBe(1);
  });

  it('2b. POSTPAID November fee starts on Dec 6', async () => {
    const rows = [fee({ billingMonth: '2026-11', description: 'Room Rent for Nov 2026' })];
    const { service } = createService(new Date(2026, 11, 6, 12), rows, 'POSTPAID');

    expect(byKey(await preview(service, '2026-12-05')).rent.daysOverdue).toBe(0);
    expect(byKey(await preview(service, '2026-12-06')).rent.daysOverdue).toBe(1);
  });

  it('4a. Partial outstanding payment: fine continues until fully settled', async () => {
    const rows = [
      fee({ description: 'Outstanding Rent for Oct 2026' }),
      payment('pay-1', 400, new Date(2026, 9, 20)),
      payment('pay-2', 600, new Date(2026, 10, 10)),
    ];
    const { service } = createService(new Date(2026, 10, 24, 12), rows);

    const result = await preview(service, '2026-11-24');
    expect(byKey(result).rent.daysOverdue).toBe(36); // Oct 6 - Nov 10
  });

  it('4b. Partial outstanding payment still accrues while balance remains', async () => {
    const rows = [
      fee({ description: 'Outstanding Rent for Oct 2026' }),
      payment('pay-1', 400, new Date(2026, 9, 20)),
    ];
    const { service } = createService(new Date(2026, 10, 24, 12), rows);

    const result = await preview(service, '2026-11-24');
    expect(byKey(result).rent.daysOverdue).toBe(50); // still unpaid
  });

  it('5. Fine is per fee type and paid-before-due types do not accumulate', async () => {
    const rows = [
      fee({ id: 'rent-1', transactionType: 'RENT', billingMonth: '2026-10' }),
      fee({
        id: 'mess-1',
        transactionType: 'MESS',
        billingMonth: '2026-10',
        status: 'COMPLETED',
        paidDate: new Date(2026, 9, 4), // before due day 5
        description: 'Mess for Oct 2026 | Pending Balance: 0',
      }),
      fee({
        id: 'eb-1',
        transactionType: 'EB_BILL',
        billingMonth: '2026-10',
        status: 'COMPLETED',
        paidDate: new Date(2026, 10, 5), // late, but stops here
        description: 'EB Bill for Oct 2026 | Pending Balance: 0',
      }),
    ];
    const { service } = createService(new Date(2026, 10, 24, 12), rows);

    const fines = byKey(await preview(service, '2026-11-24'));
    expect(fines.rent.daysOverdue).toBe(50);
    expect(fines.mess.daysOverdue).toBe(0);
    expect(fines.eb.daysOverdue).toBe(31);
    expect(Object.keys(fines).sort()).toEqual(['eb', 'mess', 'rent']);
  });

  it('5b. A fee type the student never had produces no fine entry', async () => {
    const rows = [fee({ transactionType: 'RENT', billingMonth: '2026-10' })];
    const { service } = createService(new Date(2026, 10, 24, 12), rows);

    const fines = byKey(await preview(service, '2026-11-24'));
    expect(fines.rent).toBeDefined();
    expect(fines.mess).toBeUndefined();
    expect(fines.eb).toBeUndefined();
  });
});
