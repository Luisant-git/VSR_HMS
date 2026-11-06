import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Razorpay = require('razorpay');
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma.service';
import { FeesService } from './fees.service';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';

type StoredFeeItem = { feeId: string; months: number };

const roundMoney = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class RazorpayPaymentService {
  private readonly logger = new Logger(RazorpayPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feesService: FeesService,
  ) {}

  async createOrder(dto: CreateRazorpayOrderDto) {
    const feeItems = this.normalizeFeeItems(dto.feeItems || []);
    const outstandingAmount = roundMoney(Number(dto.outstandingAmount || 0));
    if (feeItems.length === 0 && outstandingAmount <= 0) {
      throw new BadRequestException(
        'Select a fee or enter an outstanding amount.',
      );
    }

    const existing = await this.prisma.razorpayOrder.findUnique({
      where: { clientRequestId: dto.requestId },
    });
    if (existing) {
      const previousItems = this.readFeeItems(existing.feeItems);
      if (
        existing.studentId !== dto.studentId ||
        existing.outstandingAmountPaise !==
          Math.round(outstandingAmount * 100) ||
        JSON.stringify(previousItems) !== JSON.stringify(feeItems)
      ) {
        throw new ConflictException(
          'This payment request ID has already been used for different fee selections.',
        );
      }
      if (existing.status === 'CREATED' && existing.orderId) {
        return {
          keyId: this.getKeyId(),
          orderId: existing.orderId,
          amount: existing.amountPaise,
          currency: existing.currency,
          checkoutId: existing.id,
        };
      }
      if (existing.status === 'PAID') {
        throw new ConflictException(
          'This payment request has already been paid.',
        );
      }
      throw new ConflictException(
        'This payment request cannot be reused. Refresh the portal and try again.',
      );
    }

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, status: { not: 'Vacated' } },
      select: {
        id: true,
        name: true,
        mobileNo: true,
        emailId: true,
      },
    });
    if (!student) throw new NotFoundException('Active student was not found.');

    const selectedIds = feeItems.map((item) => item.feeId);
    if (new Set(selectedIds).size !== selectedIds.length) {
      throw new BadRequestException('A fee cannot be selected more than once.');
    }

    const fees = selectedIds.length
      ? await this.prisma.feeTransaction.findMany({
          where: {
            id: { in: selectedIds },
            studentId: student.id,
            status: 'PENDING',
          },
        })
      : [];
    if (fees.length !== selectedIds.length) {
      throw new ConflictException(
        'One or more selected fees are no longer unpaid. Refresh the portal and try again.',
      );
    }

    const feeById = new Map(fees.map((fee) => [fee.id, fee]));
    let totalPaise = 0;
    for (const item of feeItems) {
      const fee = feeById.get(item.feeId);
      if (
        !fee ||
        String(fee.transactionType).toUpperCase().startsWith('MESS') ||
        String(fee.transactionType).toUpperCase() === 'OUTSTANDING_PAYMENT' ||
        /^\s*outstanding\b/i.test(String(fee.description || ''))
      ) {
        throw new BadRequestException(
          'The selected fee is not payable online.',
        );
      }
      totalPaise += Math.round(Number(fee.amount) * 100) * item.months;
    }

    if (outstandingAmount > 0) {
      const outstandingInvoices = await this.prisma.feeTransaction.findMany({
        where: {
          studentId: student.id,
          status: 'PENDING',
          transactionType: { notIn: ['MESS', 'MESS DEDUCTION'] },
          description: { startsWith: 'Outstanding', mode: 'insensitive' },
        },
        select: { amount: true },
      });
      const confirmedPayments = await this.prisma.feeTransaction.findMany({
        where: {
          studentId: student.id,
          status: 'COMPLETED',
          transactionType: 'OUTSTANDING_PAYMENT',
        },
        select: { amount: true },
      });
      const remaining = roundMoney(
        Math.max(
          0,
          outstandingInvoices.reduce(
            (sum, row) => sum + Number(row.amount),
            0,
          ) -
            confirmedPayments.reduce((sum, row) => sum + Number(row.amount), 0),
        ),
      );
      if (outstandingAmount > remaining + 0.001) {
        throw new ConflictException(
          `Outstanding amount exceeds the current balance of ₹${remaining.toFixed(2)}.`,
        );
      }
      totalPaise += Math.round(outstandingAmount * 100);
    }

    if (totalPaise <= 0 || !Number.isSafeInteger(totalPaise)) {
      throw new BadRequestException('Payment total is invalid.');
    }

    const keyId = this.getKeyId();
    const secret = this.getKeySecret();
    const localOrder = await this.prisma.razorpayOrder.create({
      data: {
        studentId: student.id,
        clientRequestId: dto.requestId,
        amountPaise: totalPaise,
        feeItems: feeItems as unknown as Prisma.InputJsonValue,
        outstandingAmountPaise: Math.round(outstandingAmount * 100),
        status: 'CREATING',
      },
    });

    try {
      const gatewayOrder = await new Razorpay({
        key_id: keyId,
        key_secret: secret,
      }).orders.create({
        amount: totalPaise,
        currency: 'INR',
        receipt: localOrder.id,
        notes: {
          checkout_id: localOrder.id,
          student_id: student.id,
        },
      });
      const saved = await this.prisma.razorpayOrder.update({
        where: { id: localOrder.id },
        data: { orderId: gatewayOrder.id, status: 'CREATED' },
      });

      return {
        keyId,
        orderId: gatewayOrder.id,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        checkoutId: saved.id,
        studentName: student.name,
        email: student.emailId || undefined,
        contact: student.mobileNo || undefined,
      };
    } catch (error) {
      await this.prisma.razorpayOrder.update({
        where: { id: localOrder.id },
        data: { status: 'FAILED', paymentStatus: 'ORDER_CREATION_FAILED' },
      });
      this.logger.error(
        'Could not create Razorpay order.',
        error instanceof Error ? error.message : String(error),
      );
      throw new ServiceUnavailableException(
        'Online payment is temporarily unavailable. Please try again later.',
      );
    }
  }

  async verifyCheckout(dto: VerifyRazorpayPaymentDto) {
    const secret = this.getKeySecret();
    const expected = createHmac('sha256', secret)
      .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
      .digest('hex');
    if (!this.safeHexEqual(expected, dto.razorpay_signature)) {
      throw new BadRequestException('Razorpay payment signature is invalid.');
    }

    const paymentMethod = await this.verifyProviderPayment(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
    );
    return this.applyCapturedPayment(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      'captured',
      paymentMethod,
    );
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    body: any,
  ) {
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing raw webhook body or signature.');
    }
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Razorpay webhook verification is not configured.',
      );
    }
    const expected = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    if (!this.safeHexEqual(expected, signature)) {
      throw new BadRequestException('Razorpay webhook signature is invalid.');
    }

    const event = body?.event;
    const payment = body?.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id) {
      throw new BadRequestException(
        'Webhook payload has no payment order details.',
      );
    }

    if (event === 'payment.failed') {
      await this.prisma.razorpayOrder.updateMany({
        where: { orderId: payment.order_id, status: 'CREATED' },
        data: { paymentStatus: 'failed' },
      });
      return { received: true };
    }
    if (event !== 'payment.captured') {
      return { received: true, ignored: true };
    }

    const paymentMethod = await this.verifyProviderPayment(
      payment.order_id,
      payment.id,
    );
    await this.applyCapturedPayment(
      payment.order_id,
      payment.id,
      'captured',
      paymentMethod,
    );
    return { received: true };
  }

  private async verifyProviderPayment(orderId: string, paymentId: string) {
    const gateway = new Razorpay({
      key_id: this.getKeyId(),
      key_secret: this.getKeySecret(),
    });
    let payment: {
      order_id: string;
      amount: number | string;
      currency: string;
      status: string;
      method?: string;
    };
    try {
      payment = await gateway.payments.fetch(paymentId);
    } catch (error) {
      this.logger.error(
        'Could not retrieve Razorpay payment status.',
        error instanceof Error ? error.message : String(error),
      );
      throw new ServiceUnavailableException(
        'Unable to verify payment status with Razorpay. Please retry verification.',
      );
    }

    const localOrder = await this.prisma.razorpayOrder.findUnique({
      where: { orderId },
      select: { amountPaise: true, currency: true },
    });
    if (!localOrder)
      throw new NotFoundException('Razorpay order was not found.');
    if (
      payment.order_id !== orderId ||
      Number(payment.amount) !== localOrder.amountPaise ||
      payment.currency !== localOrder.currency
    ) {
      throw new BadRequestException(
        'Razorpay payment does not match the recorded order amount.',
      );
    }
    if (payment.status !== 'captured') {
      throw new BadRequestException(
        `Razorpay payment is not captured (status: ${payment.status}).`,
      );
    }
    return payment.method;
  }

  private async applyCapturedPayment(
    orderId: string,
    paymentId: string,
    paymentStatus: string,
    paymentMethod?: string,
    attempt = 1,
  ): Promise<{
    duplicate: boolean;
    refundRequired?: boolean;
    orderId: string;
    paymentId: string;
    payments: Array<Prisma.FeeTransactionGetPayload<{}>>;
  }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.razorpayOrder.findUnique({
            where: { orderId },
          });
          if (!order)
            throw new NotFoundException('Razorpay order was not found.');

          if (order.status === 'PAID') {
            if (order.paymentId !== paymentId) {
              throw new ConflictException(
                'A different payment has already been applied to this order.',
              );
            }
            const existingTransactions = await tx.feeTransaction.findMany({
              where: { razorpayOrderId: orderId },
              orderBy: { createdAt: 'asc' },
            });
            return {
              duplicate: true,
              orderId,
              paymentId,
              payments: existingTransactions,
            };
          }
          if (order.status === 'REFUND_REQUIRED') {
            throw new ConflictException(
              'This captured payment requires manual reconciliation. Do not retry checkout.',
            );
          }

          const selections = this.readFeeItems(order.feeItems);
          const feeIds = selections.map((item) => item.feeId);
          const fees = feeIds.length
            ? await tx.feeTransaction.findMany({
                where: {
                  id: { in: feeIds },
                  studentId: order.studentId,
                  status: 'PENDING',
                },
              })
            : [];
          if (fees.length !== feeIds.length) {
            await tx.razorpayOrder.update({
              where: { id: order.id },
              data: {
                status: 'REFUND_REQUIRED',
                paymentId,
                paymentStatus: 'captured_but_fee_changed',
                paymentMethod,
              },
            });
            return {
              duplicate: false,
              refundRequired: true,
              orderId,
              paymentId,
              payments: [],
            };
          }

          const paidDate = new Date();
          const feeById = new Map(fees.map((fee) => [fee.id, fee]));
          const paidItems: any[] = [];
          let rentPaidUntil: Date | undefined;
          const feeUpdates = await Promise.all(
            selections.map(async (selection) => {
              const fee = feeById.get(selection.feeId);
              if (
                !fee ||
                String(fee.transactionType).toUpperCase().startsWith('MESS') ||
                /^\s*outstanding\b/i.test(String(fee.description || ''))
              ) {
                throw new ConflictException(
                  'A selected fee is no longer eligible for online payment.',
                );
              }
              const finalAmount =
                (Math.round(Number(fee.amount) * 100) * selection.months) / 100;
              const description = this.buildPaidDescription(
                fee.description || '',
                selection.months,
                paymentId,
              );
              const result = await tx.feeTransaction.updateMany({
                where: {
                  id: fee.id,
                  studentId: order.studentId,
                  status: 'PENDING',
                  amount: fee.amount,
                },
                data: {
                  status: 'COMPLETED',
                  amount: finalAmount,
                  description,
                  paymentMode: 'RAZORPAY',
                  paidDate,
                  razorpayOrderId: orderId,
                  razorpayPaymentId: paymentId,
                  paymentStatus,
                  paymentMethod,
                },
              });
              if (result.count !== 1) {
                throw new ConflictException(
                  'A selected fee changed during payment processing.',
                );
              }
              if (String(fee.transactionType).toUpperCase() === 'RENT') {
                rentPaidUntil = this.getPaidUntil(
                  fee.description || '',
                  selection.months,
                  paidDate,
                );
              }
              return tx.feeTransaction.findUnique({ where: { id: fee.id } });
            }),
          );
          paidItems.push(...feeUpdates.filter(Boolean));

          const outstandingAmount = order.outstandingAmountPaise / 100;
          if (outstandingAmount > 0) {
            const outstandingResult =
              await this.feesService.applyVerifiedRazorpayOutstandingPayment(
                tx,
                order.studentId,
                outstandingAmount,
                orderId,
                paymentId,
                paymentStatus,
                paymentMethod,
              );
            paidItems.push(...outstandingResult.payments);
          }

          if (rentPaidUntil) {
            await tx.student.update({
              where: { id: order.studentId },
              data: { rentPaidUntil },
            });
          }

          await tx.razorpayOrder.update({
            where: { id: order.id },
            data: {
              status: 'PAID',
              paymentId,
              paymentStatus,
              paymentMethod,
            },
          });

          return { duplicate: false, orderId, paymentId, payments: paidItems };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2034' && attempt < 3) {
        return this.applyCapturedPayment(
          orderId,
          paymentId,
          paymentStatus,
          paymentMethod,
          attempt + 1,
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        const markedForReview = await this.prisma.razorpayOrder.updateMany({
          where: {
            orderId,
            status: { in: ['CREATED', 'FAILED'] },
          },
          data: {
            status: 'REFUND_REQUIRED',
            paymentId,
            paymentStatus: 'captured_requires_reconciliation',
            paymentMethod,
          },
        });
        if (markedForReview.count === 1) {
          this.logger.error(
            `Captured Razorpay payment ${paymentId} requires manual reconciliation for order ${orderId}.`,
          );
          return {
            duplicate: false,
            refundRequired: true,
            orderId,
            paymentId,
            payments: [],
          };
        }
      }
      throw error;
    }
  }

  private buildPaidDescription(
    description: string,
    months: number,
    paymentId: string,
  ) {
    let result = description;
    if (months > 1) {
      result += ` | Paid for ${months} Months`;
    }
    result += ` | Ref: Razorpay ${paymentId}`;
    return result;
  }

  private getPaidUntil(description: string, months: number, paidDate: Date) {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const yearMatch = description.match(/\b(20\d{2})\b/);
    const startYear = yearMatch ? Number(yearMatch[1]) : paidDate.getFullYear();
    const startMonth = monthNames.findIndex((name) =>
      description.toLowerCase().includes(name.toLowerCase()),
    );
    const monthIndex = startMonth >= 0 ? startMonth : paidDate.getMonth();
    const lastMonthIndex = monthIndex + months - 1;
    return new Date(
      startYear + Math.floor(lastMonthIndex / 12),
      (lastMonthIndex % 12) + 1,
      0,
      12,
      0,
      0,
    );
  }

  private normalizeFeeItems(items: StoredFeeItem[]) {
    if (!Array.isArray(items)) {
      throw new BadRequestException('Selected fees must be an array.');
    }
    return items
      .map((item) => ({
        feeId: String(item.feeId),
        months: Number(item.months),
      }))
      .sort((left, right) => left.feeId.localeCompare(right.feeId));
  }

  private readFeeItems(value: Prisma.JsonValue): StoredFeeItem[] {
    if (!Array.isArray(value)) {
      throw new ConflictException(
        'Stored Razorpay order fee details are invalid.',
      );
    }
    return value.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        !('feeId' in item) ||
        typeof item.feeId !== 'string' ||
        !('months' in item) ||
        typeof item.months !== 'number'
      ) {
        throw new ConflictException(
          'Stored Razorpay order fee details are invalid.',
        );
      }
      return { feeId: item.feeId, months: item.months };
    });
  }

  private safeHexEqual(expectedHex: string, actualHex: string) {
    if (
      !/^[\da-f]+$/i.test(actualHex) ||
      actualHex.length !== expectedHex.length
    ) {
      return false;
    }
    return timingSafeEqual(
      Buffer.from(expectedHex, 'hex'),
      Buffer.from(actualHex, 'hex'),
    );
  }

  private getKeyId() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      throw new ServiceUnavailableException(
        'Online payments are not configured. Contact the hostel office.',
      );
    }
    return keyId;
  }

  private getKeySecret() {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        'Online payments are not configured. Contact the hostel office.',
      );
    }
    return secret;
  }
}
