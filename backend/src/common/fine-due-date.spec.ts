import { describe, expect, it } from 'vitest';
import {
  getFineDueDay,
  getFinePeriods,
  resolveFineThrough,
  sumFineDays,
  toCanonicalDueDate,
} from './fine-due-date';

const dueDate = toCanonicalDueDate(5)!;
const cfg = (billingCycle = 'PREPAID') => ({ collegeDueDate: dueDate, billingCycle });
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('monthly fine due day', () => {
  it('stores only the day and reads it back', () => {
    expect(dueDate).toContain('2000-01-05');
    expect(getFineDueDay(dueDate)).toBe(5);
    expect(getFineDueDay('2026-10-05T00:00:00.000Z')).toBe(5);
  });

  it('starts on the 6th when the due day is 5', () => {
    const fee = { billingMonth: '2026-10' };
    expect(sumFineDays(getFinePeriods([fee], cfg(), local(2026, 10, 5)))).toBe(0);
    expect(sumFineDays(getFinePeriods([fee], cfg(), local(2026, 10, 6)))).toBe(1);
  });

  it('repeats for every following month', () => {
    const fees = [{ billingMonth: '2026-10' }, { billingMonth: '2026-11' }];
    expect(sumFineDays(getFinePeriods(fees, cfg(), local(2026, 11, 24)))).toBe(50 + 19);
  });

  it('uses the following month for POSTPAID colleges', () => {
    const fee = { billingMonth: '2026-10' };
    expect(sumFineDays(getFinePeriods([fee], cfg('POSTPAID'), local(2026, 11, 6)))).toBe(1);
  });

  it('clamps the day in short months', () => {
    const feb = toCanonicalDueDate(31)!;
    const fee = { billingMonth: '2026-02' };
    expect(sumFineDays(getFinePeriods([fee], { collegeDueDate: feb }, local(2026, 3, 1)))).toBe(1);
  });

  it('stops counting on a fee payment date', () => {
    const fee = {
      billingMonth: '2026-10',
      fineThrough: local(2026, 11, 5),
    };
    expect(sumFineDays(getFinePeriods([fee], cfg(), local(2026, 11, 24)))).toBe(31);
  });

  it('keeps the longest unpaid fee in a month', () => {
    const fees = [
      { billingMonth: '2026-10', fineThrough: local(2026, 10, 20) },
      { billingMonth: '2026-10' },
    ];
    expect(sumFineDays(getFinePeriods(fees, cfg(), local(2026, 11, 24)))).toBe(50);
  });
});

describe('resolveFineThrough', () => {
  it('stops completed fees on their payment date', () => {
    const [through] = resolveFineThrough(
      [{ status: 'COMPLETED', paidDate: local(2026, 11, 5) }],
      [],
    );
    expect(through).toEqual(local(2026, 11, 5));
  });

  it('never accrues on a completed fee with no payment date', () => {
    const [through] = resolveFineThrough([{ status: 'COMPLETED' }], []);
    expect(through?.getTime()).toBe(0);
  });

  it('allocates oldest payments to pending invoices and marks the clearing date', () => {
    const fees = [
      { id: 'a', status: 'PENDING', amount: 1000, createdAt: local(2026, 10, 1) },
      { id: 'b', status: 'PENDING', amount: 1000, createdAt: local(2026, 11, 1) },
    ];
    const payments = [
      { amount: 400, paidDate: local(2026, 10, 20) },
      { amount: 600, paidDate: local(2026, 11, 5) },
      { amount: 500, paidDate: local(2026, 11, 10) },
    ];

    expect(resolveFineThrough(fees, payments)).toEqual([
      local(2026, 11, 5),
      null, // only ₹500 of the second ₹1000 invoice is paid
    ]);
  });
});
