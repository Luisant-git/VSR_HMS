import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { FeesService } from './fees.service';

type FakeRow = {
  id: string;
  studentId: string;
  transactionType: string;
  amount: number;
  description: string | null;
  status: string;
  paymentMode?: string | null;
  paidDate?: Date | null;
  dueDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const matchesWhere = (row: FakeRow, where: any = {}) => {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'description' && value && typeof value === 'object') {
      const condition = value as { contains?: string; startsWith?: string };
      const description = row.description || '';
      if (condition.contains && !description.includes(condition.contains)) return false;
      if (
        condition.startsWith &&
        !description.toLowerCase().startsWith(condition.startsWith.toLowerCase())
      ) {
        return false;
      }
      continue;
    }
    if ((row as any)[key] !== value) return false;
  }
  return true;
};

const createFakePrisma = (seed: FakeRow[]) => {
  const store: FakeRow[] = seed.map(row => ({ ...row }));
  let sequence = 0;
  const invoiceCounterStore = new Map<string, number>();

  const tx = {
    invoiceCounter: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const current = invoiceCounterStore.get(where.period) ?? 0;
        const nextValue = current + 1;
        invoiceCounterStore.set(where.period, nextValue);
        return { period: where.period, value: nextValue };
      }),
    },
    feeTransaction: {
      findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
        let rows = store.filter(row => matchesWhere(row, where));
        if (orderBy?.createdAt === 'asc') {
          rows = [...rows].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        }
        return rows.map(row => ({ ...row }));
      }),
      create: vi.fn(async ({ data }: any) => {
        sequence += 1;
        const created: FakeRow = {
          id: `tx-${sequence}`,
          studentId: data.studentId,
          transactionType: data.transactionType,
          amount: data.amount,
          description: data.description ?? null,
          status: data.status,
          paymentMode: data.paymentMode ?? null,
          paidDate: data.paidDate ?? null,
          dueDate: data.dueDate ?? null,
          createdAt: new Date(Date.now() + sequence),
          updatedAt: new Date(Date.now() + sequence),
        };
        store.push(created);
        return { ...created };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const index = store.findIndex(row => row.id === where.id);
        if (index === -1) throw new Error('Row not found');
        store[index] = { ...store[index], ...data };
        return { ...store[index] };
      }),
    },
    $queryRaw: vi.fn(async (strings: TemplateStringsArray | string[], ...values: any[]) => {
      const period = values[0];
      const current = invoiceCounterStore.get(period) ?? 0;
      const nextValue = current + 1;
      invoiceCounterStore.set(period, nextValue);
      return [{ value: nextValue }];
    }),
  };

  const prisma = {
    $transaction: vi.fn(async (callback: any) => callback(tx)),
    $queryRaw: vi.fn(async (strings: TemplateStringsArray | string[], ...values: any[]) => {
      const period = values[0];
      const current = invoiceCounterStore.get(period) ?? 0;
      const nextValue = current + 1;
      invoiceCounterStore.set(period, nextValue);
      return [{ value: nextValue }];
    }),
  } as any;

  return { prisma, store, tx };
};

const makeRow = (overrides: Partial<FakeRow> & Pick<FakeRow, 'id' | 'amount'>): FakeRow => ({
  studentId: 'student-1',
  transactionType: 'RENT',
  description: 'Outstanding Rent for Jan 2026',
  status: 'PENDING',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

/**
 * User scenario:
 *   ₹5,000 historical outstanding (₹3,000 rent + ₹2,000 EB)
 *   ₹2,000 partial payment
 *   => remaining ₹3,000, original invoices unchanged, one payment record.
 */
const buildScenario = () => [
  makeRow({
    id: 'invoice-rent',
    amount: 3000,
    description: 'Outstanding Rent for Jan 2026',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }),
  makeRow({
    id: 'invoice-eb',
    amount: 2000,
    transactionType: 'EB_BILL',
    description: 'Outstanding EB Bill for Jan 2026',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  }),
  makeRow({
    id: 'unrelated-paid-rent',
    amount: 25000,
    description: 'Month 1 Room Rent',
    status: 'COMPLETED',
    paymentMode: 'UPI',
    paidDate: new Date('2026-02-01T00:00:00.000Z'),
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
  }),
];

describe('FeesService - outstanding payment ledger', () => {
  let service: FeesService;
  let store: FakeRow[];

  beforeEach(() => {
    const fake = createFakePrisma(buildScenario());
    store = fake.store;
    service = new FeesService(fake.prisma);
  });

  it('creates one payment record and reduces ₹5,000 to ₹3,000 without touching invoices', async () => {
    const result: any = await service.payOutstanding({
      studentId: 'student-1',
      amount: 2000,
      paymentMode: 'UPI',
      referenceNumber: 'UPI-123',
      requestId: 'req-partial-1',
    });

    expect(result.duplicate).toBe(false);
    expect(result.originalOutstanding).toBe(5000);
    expect(result.previouslyPaid).toBe(0);
    expect(result.remainingOutstanding).toBe(3000);
    expect(result.payments).toHaveLength(1);

    const payment = result.payments[0];
    expect(payment.transactionType).toBe('OUTSTANDING_PAYMENT');
    expect(payment.status).toBe('COMPLETED');
    expect(payment.amount).toBe(2000);
    expect(payment.description).toContain('UPI-123');

    // Original outstanding invoices keep their amounts and remain the source
    // of the original outstanding total.
    const rentInvoice = store.find(row => row.id === 'invoice-rent')!;
    const ebInvoice = store.find(row => row.id === 'invoice-eb')!;
    expect(rentInvoice.amount).toBe(3000);
    expect(rentInvoice.status).toBe('PENDING');
    expect(ebInvoice.amount).toBe(2000);
    expect(ebInvoice.status).toBe('PENDING');

    // Unrelated paid invoice is completely unchanged.
    const paidInvoice = store.find(row => row.id === 'unrelated-paid-rent')!;
    expect(paidInvoice.amount).toBe(25000);
    expect(paidInvoice.status).toBe('COMPLETED');
    expect(paidInvoice.paymentMode).toBe('UPI');

    // Allocation is oldest-first and only applied once.
    const rentAllocation = result.allocations.find(
      (allocation: any) => allocation.invoiceId === 'invoice-rent',
    );
    expect(rentAllocation).toMatchObject({
      originalAmount: 3000,
      paidAmount: 2000,
      appliedAmount: 2000,
      remainingAmount: 1000,
    });
    expect(
      result.allocations.find((allocation: any) => allocation.invoiceId === 'invoice-eb'),
    ).toMatchObject({ originalAmount: 2000, paidAmount: 0, remainingAmount: 2000 });

    expect(store.filter(row => row.transactionType === 'OUTSTANDING_PAYMENT')).toHaveLength(1);
  });

  it('is idempotent when the same requestId is retried', async () => {
    await service.payOutstanding({
      studentId: 'student-1',
      amount: 2000,
      paymentMode: 'UPI',
      requestId: 'req-idempotent',
    });

    const retry: any = await service.payOutstanding({
      studentId: 'student-1',
      amount: 2000,
      paymentMode: 'UPI',
      requestId: 'req-idempotent',
    });

    expect(retry.duplicate).toBe(true);
    expect(retry.amount).toBe(2000);
    expect(retry.remainingOutstanding).toBe(3000);
    expect(retry.payments).toHaveLength(1);
    expect(store.filter(row => row.transactionType === 'OUTSTANDING_PAYMENT')).toHaveLength(1);
  });

  it('rejects a payment larger than the remaining outstanding balance', async () => {
    await expect(
      service.payOutstanding({
        studentId: 'student-1',
        amount: 5001,
        paymentMode: 'CASH',
        requestId: 'req-overpay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(store.filter(row => row.transactionType === 'OUTSTANDING_PAYMENT')).toHaveLength(0);
  });

  it('records each partial payment separately and reaches ₹0 without editing invoices', async () => {
    await service.payOutstanding({
      studentId: 'student-1',
      amount: 2000,
      paymentMode: 'UPI',
      requestId: 'req-a',
    });

    const second: any = await service.payOutstanding({
      studentId: 'student-1',
      amount: 3000,
      paymentMode: 'CASH',
      requestId: 'req-b',
    });

    expect(second.previouslyPaid).toBe(2000);
    expect(second.remainingOutstanding).toBe(0);
    expect(second.payments).toHaveLength(1);
    expect(store.filter(row => row.transactionType === 'OUTSTANDING_PAYMENT')).toHaveLength(2);

    expect(store.find(row => row.id === 'invoice-rent')!.amount).toBe(3000);
    expect(store.find(row => row.id === 'invoice-eb')!.amount).toBe(2000);

    // A third payment must be rejected because nothing is left.
    await expect(
      service.payOutstanding({
        studentId: 'student-1',
        amount: 100,
        paymentMode: 'UPI',
        requestId: 'req-c',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allocates unique invoice numbers for each payment in the same month', async () => {
    const counterStore = new Map<string, number>();
    const client = {
      $queryRaw: vi.fn(async () => {
        const period = '2026-10';
        const nextValue = (counterStore.get(period) ?? 0) + 1;
        counterStore.set(period, nextValue);
        return [{ value: nextValue }];
      }),
      invoiceCounter: {
        upsert: vi.fn(async ({ where }: any) => {
          const period = where.period;
          const nextValue = (counterStore.get(period) ?? 0) + 1;
          counterStore.set(period, nextValue);
          return { value: nextValue };
        }),
      },
    };

    const nextNumbers = await Promise.all(
      [new Date('2026-10-01'), new Date('2026-10-02'), new Date('2026-10-03')].map(
        date => (service as any).allocateInvoiceNumber(client, date),
      ),
    );

    expect(nextNumbers).toEqual([
      'INV-2026-10-001',
      'INV-2026-10-002',
      'INV-2026-10-003',
    ]);
  });
});
