import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { PayOutstandingDto } from './dto/pay-outstanding.dto';
import { ImportFeeRowInput, ImportFeesDto } from './dto/import-fees.dto';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Every payment made against a student's historical outstanding balance is
 * stored as its own completed transaction of this type. Outstanding invoices
 * themselves are never edited, so their original amounts stay intact and a
 * payment can never be counted twice.
 */
const OUTSTANDING_PAYMENT_TYPE = 'OUTSTANDING_PAYMENT';
const OUTSTANDING_PREFIX = 'Outstanding';
const MONEY_EPSILON = 0.001;

const isOutstandingDescription = (fee: any) =>
  /^\s*outstanding\b/i.test(String(fee?.description || ''));

/**
 * October 2026 EB bills were imported as-is and are still collectable, so the
 * "previous settled" cut-off must not hide them. Kept in sync with the Fees
 * page helpers in frontend/src/utils/outstanding.ts.
 */
const isOctober2026EbBill = (fee: any) =>
  String(fee?.transactionType || '').toUpperCase() === 'EB_BILL' &&
  /(?:\b2026-10\b|\boct(?:ober)?\s*2026\b)/i.test(String(fee?.description || ''));

const IMPORTABLE_CATEGORIES = ['rent', 'eb', 'fine', 'advance'] as const;
type ImportCategory = (typeof IMPORTABLE_CATEGORIES)[number];

const IMPORT_CATEGORY_META: Record<
  ImportCategory,
  { label: string; transactionType: string; description: string }
> = {
  rent: {
    label: 'Rent',
    transactionType: 'RENT',
    description: 'Room Rent (adjusted from fees sheet)',
  },
  eb: {
    label: 'EB',
    transactionType: 'EB_BILL',
    description: 'EB Bill (adjusted from fees sheet)',
  },
  fine: {
    label: 'Fine',
    transactionType: 'FINE',
    description: 'Fine (adjusted from fees sheet)',
  },
  advance: {
    label: 'Advance',
    transactionType: 'ADVANCE',
    description: 'Advance Deposit (adjusted from fees sheet)',
  },
};

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateFeeDto) {
    return this.prisma.$transaction(async tx => {
      const date = (data as any).paidDate
        ? new Date((data as any).paidDate)
        : new Date();
      const invoiceNumber = await this.allocateInvoiceNumber(tx, date);
      return tx.feeTransaction.create({
        data: { ...data, invoiceNumber },
      });
    });
  }

  async findAll() {
    const rows = await this.prisma.feeTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
    return this.ensureInvoiceNumbers(rows);
  }

  async findByStudent(studentId: string) {
    const rows = await this.prisma.feeTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: { college: true }
        }
      }
    });
    return this.ensureInvoiceNumbers(rows);
  }

  async findOne(id: string) {
    const row = await this.prisma.feeTransaction.findUnique({
      where: { id },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
    if (row) await this.ensureInvoiceNumbers([row]);
    return row;
  }

  /**
   * Invoice numbers are permanent. Any row that predates the numbering feature
   * (or was created by a path that does not allocate one) gets its number here
   * exactly once. Existing numbers are never recalculated, so adding a new
   * payment cannot renumber older receipts.
   */
  private async ensureInvoiceNumbers<T extends { id: string; invoiceNumber?: string | null }>(
    rows: T[],
  ): Promise<T[]> {
    const missing = rows.filter(row => !row.invoiceNumber);
    if (missing.length === 0) return rows;

    missing.sort(
      (a, b) =>
        new Date((a as any).createdAt).getTime() -
        new Date((b as any).createdAt).getTime(),
    );

    // One invoice number per displayed receipt. Outstanding payments are each
    // their own receipt; unpaid outstanding invoices and current pending dues
    // are grouped per student; other paid fees are grouped per student/minute.
    const groups = new Map<string, T[]>();
    for (const row of missing) {
      const key = this.invoiceGroupKey(row as any);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    for (const group of groups.values()) {
      const first = group[0] as any;
      const date = new Date(first.paidDate || first.createdAt || Date.now());
      const invoiceNumber = await this.allocateInvoiceNumber(this.prisma, date);

      await this.prisma.feeTransaction.updateMany({
        where: { id: { in: group.map(row => row.id) } },
        data: { invoiceNumber },
      });
      group.forEach(row => {
        (row as any).invoiceNumber = invoiceNumber;
      });
    }

    return rows;
  }

  private invoiceGroupKey(row: any) {
    const type = String(row.transactionType || '').toUpperCase();
    if (type === OUTSTANDING_PAYMENT_TYPE) return `outstanding-payment-${row.id}`;
    if (row.status === 'PENDING' && isOutstandingDescription(row)) {
      return `outstanding-invoice-${row.studentId}`;
    }
    if (row.status === 'PENDING') return `pending-${row.studentId}`;
    const time = new Date(row.paidDate || row.createdAt).toISOString().slice(0, 16);
    return `paid-${row.studentId}-${time}`;
  }

  private invoicePeriod(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatInvoiceNumber(date: Date, serial: number) {
    return `INV-${this.invoicePeriod(date)}-${String(serial).padStart(3, '0')}`;
  }

  private async allocateInvoiceNumber(
    client: Prisma.TransactionClient | PrismaService,
    date: Date,
  ): Promise<string> {
    const period = this.invoicePeriod(date);
    const counter = await client.invoiceCounter.upsert({
      where: { period },
      create: { period, value: 1 },
      update: { value: { increment: 1 } },
    });
    return this.formatInvoiceNumber(date, counter.value);
  }

  async update(id: string, data: UpdateFeeDto) {
    return this.prisma.feeTransaction.update({
      where: { id },
      data,
    });
  }

  /**
   * Applies a (possibly partial) payment against a student's outstanding balance.
   *
   * Ledger model (no invoice is ever mutated):
   * - Outstanding invoices are the original PENDING RENT / EB_BILL rows added
   *   through the Admin "Outstanding Payments" module. Their descriptions start
   *   with "Outstanding" and their amounts are the original billed amounts.
   * - Every confirmed payment is stored as ONE separate COMPLETED
   *   `OUTSTANDING_PAYMENT` transaction.
   * - Remaining balance = sum(original outstanding invoices)
   *                       - sum(confirmed OUTSTANDING_PAYMENT transactions).
   *
   * This guarantees that a partial payment (e.g. ₹2,000 against ₹5,000) only
   * moves the balance to ₹3,000, leaves every invoice amount untouched, and is
   * never subtracted from more than one row.
   *
   * All reads/writes happen inside a serializable transaction so concurrent
   * requests cannot overpay.
   */
  async payOutstanding(dto: PayOutstandingDto) {
    const amount = roundMoney(Number(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const requestId = dto.requestId?.trim() || undefined;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.applyOutstandingPayment(tx, dto, amount, requestId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: any) {
        // P2034 = write conflict / serialization failure. Retry the whole
        // transaction so the amount is re-validated against fresh data.
        if (error?.code === 'P2034' && attempt < maxAttempts) continue;
        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Unable to process the outstanding payment. Please try again.',
    );
  }

  async applyVerifiedRazorpayOutstandingPayment(
    tx: Prisma.TransactionClient,
    studentId: string,
    amount: number,
    orderId: string,
    paymentId: string,
    paymentStatus: string,
    paymentMethod?: string,
  ) {
    return this.applyOutstandingPayment(
      tx,
      {
        studentId,
        amount,
        paymentMode: 'RAZORPAY',
        referenceNumber: `Razorpay ${paymentId}`,
        requestId: `RZP-${orderId}`,
      },
      roundMoney(amount),
      `RZP-${orderId}`,
      { orderId, paymentId, paymentStatus, paymentMethod },
    );
  }

  private async applyOutstandingPayment(
    tx: Prisma.TransactionClient,
    dto: PayOutstandingDto,
    amount: number,
    requestId?: string,
    gateway?: {
      orderId: string;
      paymentId: string;
      paymentStatus: string;
      paymentMethod?: string;
    },
  ) {
    const { studentId } = dto;

    // Idempotency: a repeat of an already applied request returns the original
    // result instead of charging the student twice.
    if (requestId) {
      const marker = `[REQ:${requestId}]`;
      const existing = await tx.feeTransaction.findMany({
        where: {
          studentId,
          status: 'COMPLETED',
          transactionType: OUTSTANDING_PAYMENT_TYPE,
          description: { contains: marker },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length > 0) {
        const payment = existing[0];
        if (!payment.invoiceNumber) {
          const invoiceNumber = await this.allocateInvoiceNumber(
            tx,
            payment.paidDate || payment.createdAt,
          );
          await tx.feeTransaction.update({
            where: { id: payment.id },
            data: { invoiceNumber },
          });
          payment.invoiceNumber = invoiceNumber;
        }
        const invoices = await this.getOutstandingInvoices(tx, studentId);
        const payments = await this.getConfirmedOutstandingPayments(tx, studentId);
        const originalOutstanding = this.sumAmounts(invoices);
        const totalPaid = this.sumAmounts(payments);
        const appliedAmount = roundMoney(Number(payment.amount) || 0);

        return {
          duplicate: true,
          studentId,
          amount: appliedAmount,
          appliedAmount,
          originalOutstanding,
          previouslyPaid: roundMoney(Math.max(0, totalPaid - appliedAmount)),
          remainingOutstanding: roundMoney(Math.max(0, originalOutstanding - totalPaid)),
          payments: [payment],
          payment,
          allocations: this.allocatePayments(invoices, totalPaid - appliedAmount, appliedAmount),
        };
      }
    }

    // Original outstanding invoices. These rows are never modified.
    const invoices = await this.getOutstandingInvoices(tx, studentId);
    if (invoices.length === 0) {
      throw new BadRequestException('This student has no outstanding balance to pay.');
    }

    const originalOutstanding = this.sumAmounts(invoices);
    const payments = await this.getConfirmedOutstandingPayments(tx, studentId);
    const previouslyPaid = this.sumAmounts(payments);
    const remainingBefore = roundMoney(Math.max(0, originalOutstanding - previouslyPaid));

    if (remainingBefore <= MONEY_EPSILON) {
      throw new BadRequestException(
        "This student's outstanding balance has already been settled.",
      );
    }

    if (amount > remainingBefore + MONEY_EPSILON) {
      throw new BadRequestException(
        `Payment amount ₹${amount.toFixed(2)} exceeds the remaining outstanding balance of ₹${remainingBefore.toFixed(2)}.`,
      );
    }

    // ONE ledger row per payment. No invoice amount or status is touched.
    const paidDate = new Date();
    const invoiceNumber = await this.allocateInvoiceNumber(tx, paidDate);
    const created = await tx.feeTransaction.create({
      data: {
        studentId,
        transactionType: OUTSTANDING_PAYMENT_TYPE,
        amount,
        status: 'COMPLETED',
        paymentMode: dto.paymentMode,
        paidDate,
        invoiceNumber,
        description: `Outstanding payment${this.buildDescriptionSuffix(dto, requestId)}`,
        razorpayOrderId: gateway?.orderId,
        razorpayPaymentId: gateway?.paymentId,
        paymentStatus: gateway?.paymentStatus,
        paymentMethod: gateway?.paymentMethod,
      },
    });

    return {
      duplicate: false,
      studentId,
      amount,
      appliedAmount: amount,
      originalOutstanding,
      previouslyPaid,
      remainingOutstanding: roundMoney(
        Math.max(0, originalOutstanding - previouslyPaid - amount),
      ),
      payments: [created],
      payment: created,
      // Read-only breakdown of how this payment maps to the original invoices
      // (oldest first). It is derived, never persisted, so a payment cannot be
      // subtracted from more than one invoice row.
      allocations: this.allocatePayments(invoices, previouslyPaid, amount),
    };
  }

  private getOutstandingInvoices(tx: Prisma.TransactionClient, studentId: string) {
    return tx.feeTransaction.findMany({
      where: {
        studentId,
        status: 'PENDING',
        transactionType: { notIn: ['MESS', 'MESS DEDUCTION'] },
        description: { startsWith: OUTSTANDING_PREFIX, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private getConfirmedOutstandingPayments(tx: Prisma.TransactionClient, studentId: string) {
    return tx.feeTransaction.findMany({
      where: {
        studentId,
        status: 'COMPLETED',
        transactionType: OUTSTANDING_PAYMENT_TYPE,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private sumAmounts(rows: Array<{ amount: number }>) {
    return roundMoney(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  }

  /**
   * Distributes already-paid and newly-paid amounts across the original
   * invoices oldest-first. Used only for the response / payment history.
   */
  private allocatePayments(
    invoices: Array<{ id: string; amount: number; transactionType: string; description: string | null }>,
    alreadyPaid: number,
    paymentAmount: number,
  ) {
    let covered = roundMoney(Math.max(0, alreadyPaid));
    let leftToApply = roundMoney(Math.max(0, paymentAmount));

    return invoices.map(invoice => {
      const originalAmount = roundMoney(Number(invoice.amount) || 0);
      const coveredBefore = roundMoney(Math.min(covered, originalAmount));
      covered = roundMoney(covered - coveredBefore);

      const available = roundMoney(originalAmount - coveredBefore);
      const appliedAmount = roundMoney(Math.min(leftToApply, available));
      leftToApply = roundMoney(leftToApply - appliedAmount);

      const paidAmount = roundMoney(coveredBefore + appliedAmount);
      return {
        invoiceId: invoice.id,
        transactionType: invoice.transactionType,
        description: invoice.description,
        originalAmount,
        paidAmount,
        appliedAmount,
        remainingAmount: roundMoney(originalAmount - paidAmount),
      };
    });
  }

  private buildDescriptionSuffix(dto: PayOutstandingDto, requestId?: string) {
    let suffix = '';
    if (dto.referenceNumber) suffix += ` | Ref: ${dto.referenceNumber}`;
    if (dto.notes) suffix += ` | Notes: ${dto.notes}`;
    if (requestId) suffix += ` | [REQ:${requestId}]`;
    return suffix;
  }

  /**
   * Applies Rent / EB / Fine / Advance values edited in the Fees Excel sheet.
   *
   * Only the student's *current* PENDING dues are touched. Paid receipts,
   * historical outstanding invoices and the pre-cutoff imported ledger are
   * never edited. A category is adjusted by its delta on the newest matching
   * row, so split invoices (for example EB shares) keep their structure.
   */
  async importFeeEdits(dto: ImportFeesDto) {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    if (rows.length === 0) {
      throw new BadRequestException(
        'The uploaded file does not contain any fee rows.',
      );
    }

    const dryRun = dto.dryRun === true;
    const changes: Array<{
      studentKey: string;
      studentId: string;
      studentName: string;
      roomNo: string | null;
      items: Array<{
        category: ImportCategory;
        label: string;
        from: number;
        to: number;
        delta: number;
      }>;
    }> = [];
    const errors: Array<{ studentKey: string; message: string }> = [];
    const seenStudents = new Set<string>();
    let unchanged = 0;

    for (const row of rows) {
      const studentKey = String(row?.studentKey ?? '').trim();
      if (!studentKey) {
        errors.push({ studentKey: '', message: 'Missing Student ID.' });
        continue;
      }

      const dedupeKey = studentKey.toUpperCase();
      if (seenStudents.has(dedupeKey)) {
        errors.push({
          studentKey,
          message: 'Duplicate Student ID in the uploaded file.',
        });
        continue;
      }
      seenStudents.add(dedupeKey);

      const parsed = this.parseImportAmounts(row);
      if (parsed.error) {
        errors.push({ studentKey, message: parsed.error });
        continue;
      }
      if (Object.keys(parsed.amounts).length === 0) {
        errors.push({
          studentKey,
          message:
            'No editable fee amount found (Rent / EB / Fine / Advance).',
        });
        continue;
      }

      try {
        const result = await this.applyFeeImportRow(
          studentKey,
          parsed.amounts,
          dryRun,
        );
        if (result.items.length > 0) {
          changes.push(result);
        } else {
          unchanged += 1;
        }
      } catch (error: any) {
        errors.push({
          studentKey,
          message: error?.message || 'Failed to update this student.',
        });
      }
    }

    return {
      dryRun,
      updated: changes.length,
      unchanged,
      errors,
      changes,
    };
  }

  private parseImportAmounts(row: ImportFeeRowInput): {
    amounts: Partial<Record<ImportCategory, number>>;
    error?: string;
  } {
    const amounts: Partial<Record<ImportCategory, number>> = {};

    for (const category of IMPORTABLE_CATEGORIES) {
      const raw = row?.[category];
      if (raw === undefined || raw === null) continue;
      if (typeof raw === 'string' && raw.trim() === '') continue;

      const numeric =
        typeof raw === 'number'
          ? raw
          : Number(String(raw).replace(/[₹,\s]/g, ''));

      if (!Number.isFinite(numeric) || numeric < 0) {
        return {
          amounts,
          error: `${IMPORT_CATEGORY_META[category].label} must be a number greater than or equal to 0.`,
        };
      }

      amounts[category] = roundMoney(numeric);
    }

    return { amounts };
  }

  private async applyFeeImportRow(
    studentKey: string,
    amounts: Partial<Record<ImportCategory, number>>,
    dryRun: boolean,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { regNo: { equals: studentKey, mode: 'insensitive' } },
          { manualRegsiName: { equals: studentKey, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        regNo: true,
        manualRegsiName: true,
        name: true,
        roomNo: true,
      },
    });

    if (!student) {
      throw new BadRequestException(
        `Student "${studentKey}" was not found.`,
      );
    }

    return this.prisma.$transaction(async tx => {
      const pendingRows = await tx.feeTransaction.findMany({
        where: { studentId: student.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      const editableRows = pendingRows.filter(fee =>
        this.isEditablePendingFeeRow(fee),
      );

      const items: Array<{
        category: ImportCategory;
        label: string;
        from: number;
        to: number;
        delta: number;
      }> = [];

      for (const category of IMPORTABLE_CATEGORIES) {
        const requested = amounts[category];
        if (requested === undefined) continue;

        const categoryRows = editableRows.filter(
          fee => this.importCategoryOf(fee) === category,
        );
        const currentTotal = this.sumAmounts(categoryRows);
        const targetTotal = roundMoney(requested);

        if (Math.abs(targetTotal - currentTotal) < MONEY_EPSILON) continue;

        if (!dryRun) {
          await this.setCategoryTotal(
            tx,
            student.id,
            category,
            categoryRows,
            targetTotal,
          );
        }

        items.push({
          category,
          label: IMPORT_CATEGORY_META[category].label,
          from: currentTotal,
          to: targetTotal,
          delta: roundMoney(targetTotal - currentTotal),
        });
      }

      return {
        studentKey: student.manualRegsiName || student.regNo,
        studentId: student.id,
        studentName: student.name,
        roomNo: student.roomNo,
        items,
      };
    });
  }

  private async setCategoryTotal(
    tx: Prisma.TransactionClient,
    studentId: string,
    category: ImportCategory,
    categoryRows: Array<{ id: string; amount: number; createdAt: Date }>,
    targetTotal: number,
  ) {
    const meta = IMPORT_CATEGORY_META[category];
    const currentTotal = this.sumAmounts(categoryRows);
    const delta = roundMoney(targetTotal - currentTotal);

    if (categoryRows.length === 0) {
      if (targetTotal > 0) {
        await tx.feeTransaction.create({
          data: {
            studentId,
            transactionType: meta.transactionType,
            amount: targetTotal,
            status: 'PENDING',
            description: meta.description,
          },
        });
      }
      return;
    }

    if (delta > 0) {
      const newest = categoryRows[categoryRows.length - 1];
      await tx.feeTransaction.update({
        where: { id: newest.id },
        data: {
          amount: roundMoney((Number(newest.amount) || 0) + delta),
        },
      });
      return;
    }

    // Lowering the total: trim the newest rows first, deleting a row once it
    // reaches zero. Older rows are left untouched unless more has to go.
    let toReduce = roundMoney(-delta);
    for (
      let index = categoryRows.length - 1;
      index >= 0 && toReduce > MONEY_EPSILON;
      index -= 1
    ) {
      const fee = categoryRows[index];
      const amount = roundMoney(Number(fee.amount) || 0);
      if (amount <= 0) continue;

      if (amount <= toReduce + MONEY_EPSILON) {
        toReduce = roundMoney(toReduce - amount);
        await tx.feeTransaction.delete({ where: { id: fee.id } });
      } else {
        await tx.feeTransaction.update({
          where: { id: fee.id },
          data: { amount: roundMoney(amount - toReduce) },
        });
        toReduce = 0;
      }
    }
  }

  /**
   * Mirrors the "Current Due" rows the Fees page renders: PENDING, not a mess
   * fee, not an outstanding invoice and not a pre-cutoff imported/settled row.
   */
  private isEditablePendingFeeRow(fee: any) {
    if (String(fee?.status || '').toUpperCase() !== 'PENDING') return false;

    const type = String(fee?.transactionType || '').toUpperCase();
    if (type.startsWith('MESS')) return false;
    if (isOutstandingDescription(fee)) return false;

    return !this.isHistoricalOrImportedFeeRow(fee);
  }

  private isHistoricalOrImportedFeeRow(fee: any) {
    if (isOctober2026EbBill(fee)) return false;

    const description = String(fee?.description || '');
    if (/november|december|2027/i.test(description)) return false;
    if (/imported/i.test(description) || /october\s*2026\b/i.test(description)) {
      return true;
    }

    const dateVal = fee?.paidDate || fee?.createdAt;
    const feeDate = new Date(dateVal);
    if (
      !Number.isNaN(feeDate.getTime()) &&
      feeDate < new Date('2026-11-01T00:00:00')
    ) {
      return true;
    }

    return false;
  }

  private importCategoryOf(fee: any): ImportCategory | 'other' {
    const type = String(fee?.transactionType || '').toUpperCase();
    if (type.includes('RENT')) return 'rent';
    if (type.includes('EB') || type.includes('ELECTRIC')) return 'eb';
    if (type.includes('FINE')) return 'fine';
    if (type.includes('ADVANCE')) return 'advance';
    return 'other';
  }

  async remove(id: string) {
    return this.prisma.feeTransaction.delete({
      where: { id },
    });
  }
}
