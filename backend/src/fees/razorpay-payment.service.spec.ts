import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeesService } from './fees.service';
import { RazorpayPaymentService } from './razorpay-payment.service';

describe('RazorpayPaymentService signature checks', () => {
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  const previousWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const service = new RazorpayPaymentService({} as never, {} as FeesService);

  afterEach(() => {
    if (previousKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKeyId;
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

  it('reconciles a captured UPI payment when the browser callback was missed', async () => {
    const order = {
      id: 'checkout-1',
      orderId: 'order-1',
      status: 'CREATED',
      paymentId: null,
      paymentStatus: null,
      paymentMethod: null,
    };
    const paidFee = {
      id: 'fee-1',
      status: 'COMPLETED',
      razorpayOrderId: 'order-1',
      razorpayPaymentId: 'pay-1',
    };
    const prisma = {
      razorpayOrder: { findUnique: vi.fn().mockResolvedValue(order) },
    };
    const paymentService = new RazorpayPaymentService(
      prisma as never,
      {} as FeesService,
    );
    const applyCapturedPayment = vi.fn().mockResolvedValue({
      duplicate: false,
      orderId: 'order-1',
      paymentId: 'pay-1',
      payments: [paidFee],
    });
    paymentService['fetchOrderPayments'] = vi.fn().mockResolvedValue({
      count: 1,
      items: [
        {
          id: 'pay-1',
          order_id: 'order-1',
          status: 'captured',
          captured: true,
          created_at: 1,
        },
      ],
    });
    paymentService['verifyProviderPayment'] = vi.fn().mockResolvedValue('upi');
    paymentService['applyCapturedPayment'] = applyCapturedPayment;

    await expect(paymentService.reconcileOrder('order-1')).resolves.toMatchObject({
      duplicate: false,
      paymentId: 'pay-1',
      payments: [paidFee],
    });
    expect(applyCapturedPayment).toHaveBeenCalledWith(
      'order-1',
      'pay-1',
      'captured',
      'upi',
    );
  });

  it('creates online orders with automatic capture enabled', async () => {
    const orderUpdate = vi.fn().mockResolvedValue({
      id: 'checkout-1',
      orderId: 'order-1',
      amountPaise: 10000,
      currency: 'INR',
    });
    const prisma = {
      razorpayOrder: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'checkout-1',
          studentId: 'student-1',
          clientRequestId: 'request-1',
          amountPaise: 10000,
          feeItems: [{ feeId: 'fee-1', months: 1 }],
          outstandingAmountPaise: 0,
          status: 'CREATING',
        }),
        update: orderUpdate,
      },
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'student-1',
          name: 'Student',
          mobileNo: '9876543210',
          emailId: 'student@example.com',
        }),
      },
      feeTransaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'fee-1',
            studentId: 'student-1',
            status: 'PENDING',
            transactionType: 'RENT',
            amount: 100,
            description: 'November rent',
          },
        ]),
      },
    };
    const paymentService = new RazorpayPaymentService(
      prisma as never,
      {} as FeesService,
    );
    process.env.RAZORPAY_KEY_ID = 'rzp_test_id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    const createGatewayOrder = vi.fn().mockResolvedValue({
      id: 'order-1',
      amount: 10000,
      currency: 'INR',
    });
    paymentService['createGatewayOrder'] = createGatewayOrder;

    await expect(
      paymentService.createOrder({
        studentId: 'student-1',
        feeItems: [{ feeId: 'fee-1', months: 1 }],
        outstandingAmount: 0,
        requestId: 'request-1',
      }),
    ).resolves.toMatchObject({ orderId: 'order-1', amount: 10000 });

    expect(createGatewayOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: 'INR',
        payment: expect.objectContaining({
          capture: 'automatic',
          capture_options: expect.objectContaining({
            automatic_expiry_period: 12,
            refund_speed: 'normal',
          }),
        }),
        receipt: 'checkout-1',
        notes: { checkout_id: 'checkout-1', student_id: 'student-1' },
      }),
    );
    expect(orderUpdate).toHaveBeenCalled();
  });

  it('keeps fees unpaid when Razorpay has no captured payment for the order', async () => {
    const prisma = {
      razorpayOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'checkout-1',
          orderId: 'order-1',
          status: 'CREATED',
          paymentId: null,
          paymentStatus: null,
        }),
      },
    };
    const paymentService = new RazorpayPaymentService(
      prisma as never,
      {} as FeesService,
    );
    paymentService['fetchOrderPayments'] = vi.fn().mockResolvedValue({
      count: 0,
      items: [],
    });

    await expect(paymentService.reconcileOrder('order-1')).resolves.toMatchObject({
      status: 'CREATED',
      paymentStatus: 'pending',
      attemptCount: 0,
      payments: [],
    });
  });
});
