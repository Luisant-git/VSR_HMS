import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { PayOutstandingDto } from './dto/pay-outstanding.dto';

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

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateFeeDto) {
    return this.prisma.feeTransaction.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.feeTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
  }

  async findByStudent(studentId: string) {
    return this.prisma.feeTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: { college: true }
        }
      }
    });
  }

  async findOne(id: string) {
    return this.prisma.feeTransaction.findUnique({
      where: { id },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
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

  private async applyOutstandingPayment(
    tx: Prisma.TransactionClient,
    dto: PayOutstandingDto,
    amount: number,
    requestId?: string,
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
    const created = await tx.feeTransaction.create({
      data: {
        studentId,
        transactionType: OUTSTANDING_PAYMENT_TYPE,
        amount,
        status: 'COMPLETED',
        paymentMode: dto.paymentMode,
        paidDate: new Date(),
        description: `Outstanding payment${this.buildDescriptionSuffix(dto, requestId)}`,
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

  async remove(id: string) {
    return this.prisma.feeTransaction.delete({
      where: { id },
    });
  }
}
