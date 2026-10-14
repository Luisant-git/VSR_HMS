import { describe, expect, it, vi } from 'vitest';
import { CanteenService } from './canteen.service';

describe('CanteenService', () => {
  it('retries when the generated invoice number is already in use', async () => {
    const tx = {
      canteenPurchase: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 'existing-purchase' })
          .mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue({ id: 'new-purchase' }),
      },
      canteenProduct: {
        update: vi.fn().mockResolvedValue({ id: 'product-1' }),
      },
      canteenPaymentMode: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cash', name: 'Cash' }),
      },
      canteenSupplierPayment: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
      },
    };

    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
      canteenPurchase: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    const service = new CanteenService(prisma as any);

    await service.createPurchase({
      supplierId: 'supplier-1',
      paymentModeId: 'cash',
      purchaseDate: '2026-10-14',
      notes: 'Test purchase',
      items: [
        {
          productId: 'product-1',
          productName: 'Rice',
          qty: 2,
          unit: 'kg',
          price: 50,
        },
      ],
    });

    expect(tx.canteenPurchase.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.canteenPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceNo: expect.stringMatching(/^PUR-2026-0002$/),
        }),
      }),
    );
  });
});
