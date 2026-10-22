import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { PayOutstandingDto } from './dto/pay-outstanding.dto';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

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
   * Outstanding invoices are the pending RENT / EB_BILL rows added through the
   * Admin "Outstanding Payments" module (their descriptions start with
   * "Outstanding"). The payment is allocated oldest-first inside a single
   * serializable database transaction so concurrent requests cannot overpay.
   *
   * - A fully covered invoice is marked COMPLETED.
   * - A partially covered invoice is split: the original pending row keeps the
   *   remaining balance and a COMPLETED row is created for the paid portion so
   *   the payment immediately shows up in the existing payment history.
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
        where: { studentId, description: { contains: marker } },
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length > 0) {
        const stillOutstanding = await this.getOutstandingTransactions(tx, studentId);
        const appliedAmount = roundMoney(existing.reduce((sum, fee) => sum + fee.amount, 0));
        return {
          duplicate: true,
          studentId,
          amount: appliedAmount,
          appliedAmount,
          remainingOutstanding: roundMoney(
            stillOutstanding.reduce((sum, fee) => sum + fee.amount, 0),
          ),
          payments: existing,
        };
      }
    }

    const outstanding = await this.getOutstandingTransactions(tx, studentId);
    if (outstanding.length === 0) {
      throw new BadRequestException('This student has no outstanding balance to pay.');
    }

    const totalOutstanding = roundMoney(outstanding.reduce((sum, fee) => sum + fee.amount, 0));
    if (amount > totalOutstanding + 0.001) {
      throw new BadRequestException(
        `Payment amount ₹${amount.toFixed(2)} exceeds the remaining outstanding balance of ₹${totalOutstanding.toFixed(2)}.`,
      );
    }

    const suffix = this.buildDescriptionSuffix(dto, requestId);
    const payments: any[] = [];
    let leftToApply = amount;

    for (const fee of outstanding) {
      if (leftToApply <= 0.001) break;
      const feeAmount = roundMoney(fee.amount);

      if (leftToApply + 0.001 >= feeAmount) {
        // Fully settle this outstanding invoice.
        const updated = await tx.feeTransaction.update({
          where: { id: fee.id },
          data: {
            status: 'COMPLETED',
            paymentMode: dto.paymentMode,
            paidDate: new Date(),
            description: `${fee.description || 'Outstanding balance'}${suffix}`,
          },
        });
        payments.push(updated);
        leftToApply = roundMoney(leftToApply - feeAmount);
      } else {
        // Partial settlement. Keep the invoice pending with the remaining
        // balance and record the paid portion as a completed transaction.
        const paidPortion = leftToApply;
        await tx.feeTransaction.update({
          where: { id: fee.id },
          data: { amount: roundMoney(feeAmount - paidPortion) },
        });

        const created = await tx.feeTransaction.create({
          data: {
            studentId,
            transactionType: fee.transactionType,
            amount: paidPortion,
            status: 'COMPLETED',
            paymentMode: dto.paymentMode,
            paidDate: new Date(),
            description: `${fee.description || 'Outstanding balance'} | Partial payment${suffix}`,
          },
        });
        payments.push(created);
        leftToApply = 0;
      }
    }

    if (leftToApply > 0.001) {
      // Roll back rather than silently losing money if allocation failed.
      throw new BadRequestException(
        'Unable to fully apply the payment to the outstanding balance.',
      );
    }

    const stillOutstanding = await this.getOutstandingTransactions(tx, studentId);

    return {
      duplicate: false,
      studentId,
      amount,
      appliedAmount: amount,
      remainingOutstanding: roundMoney(
        stillOutstanding.reduce((sum, fee) => sum + fee.amount, 0),
      ),
      payments,
    };
  }

  private getOutstandingTransactions(tx: Prisma.TransactionClient, studentId: string) {
    return tx.feeTransaction.findMany({
      where: {
        studentId,
        status: 'PENDING',
        description: { startsWith: 'Outstanding', mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
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
