import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeesService } from './fees.service';
import { RazorpayPaymentService } from './razorpay-payment.service';

describe('RazorpayPaymentService signature checks', () => {
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const previousWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const service = new RazorpayPaymentService({} as never, {} as FeesService);

  afterEach(() => {
    if (previousKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
    if (previousWebhookSecret === undefined)
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousWebhookSecret;
  });

  it('rejects invalid checkout signatures before database access', async () => {
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';

    await expect(
      service.verifyCheckout({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'invalid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid webhook signatures before database access', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';

    await expect(
      service.handleWebhook(
        Buffer.from('{"event":"payment.captured"}'),
        'invalid',
        { event: 'payment.captured' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks a pending fee paid once after the captured-payment flow is invoked', async () => {
    const fee = {
      id: 'fee-1',
      studentId: 'student-1',
      transactionType: 'RENT',
      amount: 100,
      description: 'Room Rent for November 2026',
      status: 'PENDING',
    };
    const paidFee = {
      ...fee,
      amount: 100,
      status: 'COMPLETED',
      paymentMode: 'RAZORPAY',
      razorpayOrderId: 'order-1',
      razorpayPaymentId: 'pay-1',
      paymentStatus: 'captured',
      paymentMethod: 'upi',
    };
    const order = {
      id: 'checkout-1',
      studentId: 'student-1',
      orderId: 'order-1',
      status: 'CREATED',
      paymentId: null,
      feeItems: [{ feeId: 'fee-1', months: 1 }],
      outstandingAmountPaise: 0,
    };
    const tx = {
      razorpayOrder: {
        findUnique: vi.fn().mockResolvedValue(order),
        update: vi
          .fn()
          .mockResolvedValue({ ...order, status: 'PAID', paymentId: 'pay-1' }),
      },
      feeTransaction: {
        findMany: vi.fn().mockResolvedValue([fee]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(paidFee),
      },
      student: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const paymentService = new RazorpayPaymentService(
      prisma as never,
      {} as FeesService,
    );

    const result = await paymentService['applyCapturedPayment'](
      'order-1',
      'pay-1',
      'captured',
      'upi',
    );

    expect(result).toMatchObject({
      duplicate: false,
      orderId: 'order-1',
      paymentId: 'pay-1',
      payments: [paidFee],
    });
    expect(tx.feeTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'fee-1',
          status: 'PENDING',
        }),
        data: expect.objectContaining({
          status: 'COMPLETED',
          paymentMode: 'RAZORPAY',
          razorpayOrderId: 'order-1',
          razorpayPaymentId: 'pay-1',
          paymentStatus: 'captured',
          paymentMethod: 'upi',
        }),
      }),
    );
    expect(tx.razorpayOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID', paymentId: 'pay-1' }),
      }),
    );
  });

  it('returns the original transaction instead of applying a captured payment twice', async () => {
    const existingFee = {
      id: 'fee-1',
      status: 'COMPLETED',
      razorpayOrderId: 'order-1',
      razorpayPaymentId: 'pay-1',
    };
    const tx = {
      razorpayOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'checkout-1',
          orderId: 'order-1',
          status: 'PAID',
          paymentId: 'pay-1',
        }),
        update: vi.fn(),
      },
      feeTransaction: {
        findMany: vi.fn().mockResolvedValue([existingFee]),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const paymentService = new RazorpayPaymentService(
      prisma as never,
      {} as FeesService,
    );

    const result = await paymentService['applyCapturedPayment'](
      'order-1',
      'pay-1',
      'captured',
      'upi',
    );

    expect(result).toMatchObject({
      duplicate: true,
      orderId: 'order-1',
      paymentId: 'pay-1',
      payments: [existingFee],
    });
    expect(tx.feeTransaction.updateMany).not.toHaveBeenCalled();
    expect(tx.razorpayOrder.update).not.toHaveBeenCalled();
  });
});
