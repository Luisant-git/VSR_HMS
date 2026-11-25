import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FineCronService } from './fine-cron.service';

const DUE_DAY_5 = '2000-01-05T00:00:00.000Z';
const DUE_DAY_31 = '2000-01-31T00:00:00.000Z';

function createService(now: Date, college: Record<string, unknown>, transactions: unknown[]) {
  vi.useFakeTimers();
  vi.setSystemTime(now);

  const createdFines: Array<Record<string, unknown>> = [];
  const updatedFines: Array<Record<string, unknown>> = [];

  const prisma = {
    college: { findMany: vi.fn().mockResolvedValue([college]) },
    student: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'stu-1', regNo: 'S1', status: 'Active', transactions },
      ]),
    },
    feeTransaction: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockImplementation(async ({ data }) => {
        createdFines.push(data);
        return { id: `fine-${createdFines.length}`, ...data };
      }),
      update: vi.fn().mockImplementation(async ({ data }) => {
        updatedFines.push(data);
        return data;
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
  };

  const service = new FineCronService(prisma as never);
  return { service, prisma, createdFines, updatedFines };
}

function college(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-1',
    dueDate: new Date(DUE_DAY_5),
    billingCycle: 'PAY_AS_YOU_GO',
    fineMaster: { rentFine: 10, messFine: 10, ebFine: 10 },
    ...overrides,
  };
}

function rentFee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fee-1',
    transactionType: 'RENT',
    status: 'PENDING',
    amount: 1000,
    billingMonth: '2026-08',
    ...overrides,
  };
}

function outstandingPayment(amount: number, paidDate: Date) {
  return {
    id: `pay-${paidDate.getTime()}`,
    transactionType: 'OUTSTANDING_PAYMENT',
    status: 'COMPLETED',
    amount,
    paidDate,
  };
}

describe('FineCronService monthly recurring fines', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the fine the day after the configured day and repeats every month', async () => {
    const fee = rentFee();

    const onDueDate = createService(new Date(2026, 7, 5, 12), college(), [fee]);
    await onDueDate.service.handleDailyFines();
    expect(onDueDate.createdFines).toHaveLength(0);

    const dayAfter = createService(new Date(2026, 7, 6, 12), college(), [fee]);
    await dayAfter.service.handleDailyFines();
    expect(dayAfter.createdFines).toMatchObject([
      { amount: 10, description: expect.stringContaining('1 days overdue') },
    ]);

    const nextMonth = createService(new Date(2026, 8, 6, 12), college(), [fee]);
    await nextMonth.service.handleDailyFines();
    expect(nextMonth.createdFines).toMatchObject([
      { amount: 320, description: expect.stringContaining('32 days overdue') },
    ]);
  });

  it('clamps the due day to the last day of shorter months', async () => {
    const juneFee = rentFee({ billingMonth: '2026-06' });
    const config = college({ dueDate: new Date(DUE_DAY_31) });

    const onClampedDay = createService(new Date(2026, 5, 30, 12), config, [juneFee]);
    await onClampedDay.service.handleDailyFines();
    expect(onClampedDay.createdFines).toHaveLength(0);

    const dayAfter = createService(new Date(2026, 6, 1, 12), config, [juneFee]);
    await dayAfter.service.handleDailyFines();
    expect(dayAfter.createdFines).toMatchObject([
      { amount: 10, description: expect.stringContaining('1 days overdue') },
    ]);
  });

  it('does not fine a fee that is already paid', async () => {
    const paid = rentFee({ status: 'COMPLETED' });

    const result = createService(new Date(2026, 8, 10, 12), college(), [paid]);
    await result.service.handleDailyFines();
    expect(result.createdFines).toHaveLength(0);
    expect(result.updatedFines).toHaveLength(0);
  });

  it('shifts POSTPAID fees to the following month before applying the day', async () => {
    const fee = rentFee();
    const config = college({ billingCycle: 'POSTPAID' });

    const onDueDate = createService(new Date(2026, 8, 5, 12), config, [fee]);
    await onDueDate.service.handleDailyFines();
    expect(onDueDate.createdFines).toHaveLength(0);

    const dayAfter = createService(new Date(2026, 8, 6, 12), config, [fee]);
    await dayAfter.service.handleDailyFines();
    expect(dayAfter.createdFines).toMatchObject([
      { amount: 10, description: expect.stringContaining('1 days overdue') },
    ]);
  });

  it('charges a late-paid fee only up to its payment date', async () => {
    const paid = rentFee({
      status: 'COMPLETED',
      paidDate: new Date(2026, 8, 5), // Aug fee, paid on Sep 5: 31 days
    });

    const result = createService(new Date(2026, 8, 10, 12), college(), [paid]);
    await result.service.handleDailyFines();
    expect(result.createdFines).toMatchObject([
      { amount: 310, description: expect.stringContaining('31 days overdue') },
    ]);
  });

  it('stops an outstanding invoice when the final partial payment clears it', async () => {
    const invoice = rentFee({ description: 'Outstanding Rent for Aug 2026' });
    const payments = [
      outstandingPayment(400, new Date(2026, 7, 20)),
      outstandingPayment(600, new Date(2026, 8, 5)),
    ];

    const result = createService(new Date(2026, 8, 10, 12), college(), [invoice, ...payments]);
    await result.service.handleDailyFines();
    expect(result.createdFines).toMatchObject([
      { amount: 310, description: expect.stringContaining('31 days overdue') },
    ]);
  });

  it('does not fine a fee paid on or before the due day', async () => {
    const paid = rentFee({
      status: 'COMPLETED',
      paidDate: new Date(2026, 7, 5),
    });

    const result = createService(new Date(2026, 8, 10, 12), college(), [paid]);
    await result.service.handleDailyFines();
    expect(result.createdFines).toHaveLength(0);
  });

  it('tracks separate monthly fine rows continuously at 1x rate across months without doubling', async () => {
    const novFee = rentFee({ id: 'fee-nov', billingMonth: '2026-11' });
    const decFee = rentFee({ id: 'fee-dec', billingMonth: '2026-12' });
    const config = college({
      billingCycle: 'POSTPAID',
      fineMaster: { rentFine: 50, messFine: 0, ebFine: 0 },
    });

    // As of Jan 10, 2027:
    // - Nov 2026 was due Dec 5, 2026 -> 36 days @ 50 = 1800 (no doubling)
    // - Dec 2026 was due Jan 5, 2027 -> 5 days @ 50 = 250
    const result = createService(new Date(2027, 0, 10, 12), config, [novFee, decFee]);
    await result.service.handleDailyFines();

    expect(result.createdFines).toHaveLength(2);
    expect(result.createdFines[0]).toMatchObject({
      billingMonth: '2026-11',
      amount: 1800,
      description: expect.stringContaining('Nov 2026'),
    });
    expect(result.createdFines[1]).toMatchObject({
      billingMonth: '2026-12',
      amount: 250,
      description: expect.stringContaining('Dec 2026'),
    });
  });
});
