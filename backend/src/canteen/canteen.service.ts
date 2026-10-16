import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  applyStockMovement,
  reverseMovementsForReference,
  toDateStr,
} from './stock-ledger';

@Injectable()
export class CanteenService {
  constructor(private prisma: PrismaService) {}

  private isUniqueConstraintError(error: any, target: string) {
    return error?.code === 'P2002' && Array.isArray(error?.meta?.target) && error.meta.target.includes(target);
  }

  private async generateUniqueReferenceNumber(
    args: {
      tx?: any;
      modelName: 'canteenPurchase' | 'canteenSupplierPayment';
      fieldName: 'invoiceNo' | 'paymentNo';
      prefix: 'PUR' | 'PAY';
      startAt?: number;
    }
  ) {
    const year = new Date().getFullYear();
    const model = (args.tx ?? this.prisma)[args.modelName];
    let sequence = args.startAt ?? 1;
    let number = `${args.prefix}-${year}-${sequence.toString().padStart(4, '0')}`;

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const existing = await model.findUnique({
        where: { [args.fieldName]: number },
      });

      if (!existing) {
        return number;
      }

      sequence += 1;
      number = `${args.prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
    }

    throw new Error(`Unable to generate a unique ${args.prefix} reference number after multiple attempts.`);
  }

  // ---------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------
  async getCategories() {
    return this.prisma.canteenCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
  }

  async createCategory(data: { name: string; description?: string }) {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Category name is required.');
    }
    const name = data.name.trim();
    const existing = await this.prisma.canteenCategory.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Category "${name}" already exists.`);
    }
    return this.prisma.canteenCategory.create({
      data: { name, description: data.description }
    });
  }

  async updateCategory(id: string, data: { name?: string; description?: string }) {
    const existing = await this.prisma.canteenCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');

    if (data.name && data.name.trim() !== existing.name) {
      const name = data.name.trim();
      const clash = await this.prisma.canteenCategory.findUnique({ where: { name } });
      if (clash) throw new BadRequestException(`Category "${name}" already exists.`);
    }

    return this.prisma.canteenCategory.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined
      }
    });
  }

  async deleteCategory(id: string) {
    return this.prisma.canteenCategory.delete({ where: { id } });
  }

  // ---------------------------------------------------------
  // UNITS
  // ---------------------------------------------------------
  async getUnits() {
    return this.prisma.canteenUnit.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
  }

  async createUnit(data: { name: string; symbol?: string }) {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Unit name is required.');
    }
    const name = data.name.trim();
    const existing = await this.prisma.canteenUnit.findUnique({ where: { name } });
    if (existing) throw new BadRequestException(`Unit "${name}" already exists.`);
    return this.prisma.canteenUnit.create({
      data: { name, symbol: data.symbol }
    });
  }

  async updateUnit(id: string, data: { name?: string; symbol?: string }) {
    const existing = await this.prisma.canteenUnit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found');

    if (data.name && data.name.trim() !== existing.name) {
      const name = data.name.trim();
      const clash = await this.prisma.canteenUnit.findUnique({ where: { name } });
      if (clash) throw new BadRequestException(`Unit "${name}" already exists.`);
    }

    return this.prisma.canteenUnit.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        symbol: data.symbol !== undefined ? data.symbol : undefined
      }
    });
  }

  async deleteUnit(id: string) {
    return this.prisma.canteenUnit.delete({ where: { id } });
  }

  // ---------------------------------------------------------
  // SUPPLIERS
  // ---------------------------------------------------------
  async getSuppliers() {
    return this.prisma.canteenSupplier.findMany({
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: 'asc' }
    });
  }

  async createSupplier(data: { name: string; phone?: string; email?: string; address?: string; gstNo?: string }) {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Supplier name is required.');
    }
    return this.prisma.canteenSupplier.create({
      data: {
        name: data.name.trim(),
        phone: data.phone,
        email: data.email,
        address: data.address,
        gstNo: data.gstNo
      }
    });
  }

  async updateSupplier(id: string, data: { name?: string; phone?: string; email?: string; address?: string; gstNo?: string }) {
    const existing = await this.prisma.canteenSupplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Supplier not found');

    return this.prisma.canteenSupplier.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? data.email : undefined,
        address: data.address !== undefined ? data.address : undefined,
        gstNo: data.gstNo !== undefined ? data.gstNo : undefined,
      }
    });
  }

  async deleteSupplier(id: string) {
    return this.prisma.canteenSupplier.delete({ where: { id } });
  }

  // ---------------------------------------------------------
  // PAYMENT MODES
  // ---------------------------------------------------------
  async getPaymentModes() {
    return this.prisma.canteenPaymentMode.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createPaymentMode(data: { name: string }) {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Payment mode name is required.');
    }
    const name = data.name.trim();
    const existing = await this.prisma.canteenPaymentMode.findUnique({ where: { name } });
    if (existing) throw new BadRequestException(`Payment mode "${name}" already exists.`);
    return this.prisma.canteenPaymentMode.create({
      data: { name }
    });
  }

  async updatePaymentMode(id: string, data: { name?: string }) {
    const existing = await this.prisma.canteenPaymentMode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment mode not found');

    if (data.name && data.name.trim() !== existing.name) {
      const name = data.name.trim();
      const clash = await this.prisma.canteenPaymentMode.findUnique({ where: { name } });
      if (clash) throw new BadRequestException(`Payment mode "${name}" already exists.`);
    }

    return this.prisma.canteenPaymentMode.update({
      where: { id },
      data: { name: data.name ? data.name.trim() : undefined }
    });
  }

  async deletePaymentMode(id: string) {
    const existing = await this.prisma.canteenPaymentMode.findUnique({ where: { id } });
    if (existing?.isSystem) {
      throw new BadRequestException('System default payment modes cannot be deleted.');
    }
    return this.prisma.canteenPaymentMode.delete({ where: { id } });
  }

  // ---------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------
  async getProducts() {
    return this.prisma.canteenProduct.findMany({
      include: {
        category: true,
        unit: true
      },
      orderBy: { name: 'asc' }
    });
  }

  async createProduct(data: {
    name: string;
    code?: string;
    categoryId?: string;
    unitId?: string;
    price?: number;
    costPrice?: number;
    status?: string;
  }) {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Product name is required.');
    }
    const name = data.name.trim();

    let finalCode = data.code ? data.code.trim() : '';
    if (!finalCode) {
      const lastProduct = await this.prisma.canteenProduct.findFirst({
        where: { code: { startsWith: 'P' } },
        orderBy: { code: 'desc' },
      });
      if (lastProduct && lastProduct.code) {
        const lastNumber = parseInt(lastProduct.code.substring(1), 10);
        finalCode = `P${(isNaN(lastNumber) ? 0 : lastNumber + 1).toString().padStart(6, '0')}`;
      } else {
        const count = await this.prisma.canteenProduct.count();
        finalCode = `P${(count + 1).toString().padStart(6, '0')}`;
      }
    } else {
      const existingCode = await this.prisma.canteenProduct.findUnique({ where: { code: finalCode } });
      if (existingCode) throw new BadRequestException(`Product code/barcode "${finalCode}" is already in use.`);
    }

    return this.prisma.canteenProduct.create({
      data: {
        name,
        code: finalCode,
        categoryId: data.categoryId || null,
        unitId: data.unitId || null,
        price: data.price !== undefined ? Number(data.price) : 0.0,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : 0.0,
        // Stock is NEVER set directly here. A new product starts at 0 and stock
        // only moves through Purchase Entry or Kitchen Consumption — both of
        // which write to the stock ledger.
        availableStock: 0.0,
        status: data.status || 'Active'
      },
      include: {
        category: true,
        unit: true
      }
    });
  }

  async updateProduct(id: string, data: {
    name?: string;
    code?: string;
    categoryId?: string;
    unitId?: string;
    price?: number;
    costPrice?: number;
    status?: string;
  }) {
    const existing = await this.prisma.canteenProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    if (data.code && data.code.trim() !== existing.code) {
      const code = data.code.trim();
      const clash = await this.prisma.canteenProduct.findUnique({ where: { code } });
      if (clash) throw new BadRequestException(`Product code "${code}" is already in use.`);
    }

    // NOTE: `availableStock` is intentionally NOT accepted here. Stock can only
    // be changed through Purchase Entry or Kitchen Consumption, so the API can
    // no longer silently overwrite it.
    return this.prisma.canteenProduct.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        code: data.code !== undefined ? (data.code ? data.code.trim() : null) : undefined,
        categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
        unitId: data.unitId !== undefined ? (data.unitId || null) : undefined,
        price: data.price !== undefined ? Number(data.price) : undefined,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : undefined,
        status: data.status !== undefined ? data.status : undefined,
      },
      include: {
        category: true,
        unit: true
      }
    });
  }

  async deleteProduct(id: string) {
    return this.prisma.canteenProduct.delete({ where: { id } });
  }

  // ---------------------------------------------------------
  // PURCHASES (Purchase Entry & Reports)
  // ---------------------------------------------------------
  async getPurchases() {
    return this.prisma.canteenPurchase.findMany({
      include: {
        supplier: true,
        paymentMode: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPurchaseById(id: string) {
    const purchase = await this.prisma.canteenPurchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        paymentMode: true,
        items: {
          include: { product: true }
        }
      }
    });
    if (!purchase) throw new NotFoundException('Purchase entry not found');
    return purchase;
  }

  async createPurchase(data: {
    supplierId?: string;
    paymentModeId?: string;
    notes?: string;
    purchaseDate?: string;
    items: Array<{
      productId?: string;
      productName: string;
      qty: number;
      unit?: string;
      price: number;
    }>;
  }) {
    if (!data.supplierId || data.supplierId.trim() === '') {
      throw new BadRequestException('Supplier is required. Please select a Supplier before submitting.');
    }

    if (!data.paymentModeId || data.paymentModeId.trim() === '') {
      throw new BadRequestException('Payment Mode is required. Please select a Payment Mode before submitting.');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Purchase entry must contain at least one item.');
    }

    let totalAmount = 0;
    const itemDataList: any[] = [];

    for (const item of data.items) {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const totalItemAmt = qty * price;
      totalAmount += totalItemAmt;

      itemDataList.push({
        productId: item.productId || null,
        productName: item.productName.trim(),
        qty,
        unit: item.unit || null,
        price,
        totalAmount: totalItemAmt
      });
    }

    return this.prisma.$transaction(async (tx: any) => {
      let purchase: any = null;
      let invoiceNo = '';

      for (let attempt = 0; attempt < 10; attempt += 1) {
        invoiceNo = await this.generateUniqueReferenceNumber({
          tx,
          modelName: 'canteenPurchase',
          fieldName: 'invoiceNo',
          prefix: 'PUR',
          startAt: attempt + 1,
        });

        try {
          purchase = await tx.canteenPurchase.create({
            data: {
              invoiceNo,
              purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
              supplierId: data.supplierId || null,
              paymentModeId: data.paymentModeId || null,
              totalAmount,
              notes: data.notes || null,
              items: {
                create: itemDataList
              }
            },
            include: {
              supplier: true,
              paymentMode: true,
              items: true
            }
          });
          break;
        } catch (error) {
          if (this.isUniqueConstraintError(error, 'invoiceNo')) {
            continue;
          }
          throw error;
        }
      }

      if (!purchase) {
        throw new Error('Unable to create a unique purchase invoice after multiple retries.');
      }

      const purchaseDateStr = toDateStr(data.purchaseDate ? new Date(data.purchaseDate) : new Date());
      for (const item of data.items) {
        if (item.productId) {
          await tx.canteenProduct.update({
            where: { id: item.productId },
            data: { costPrice: Number(item.price) || 0 }
          });
          // Purchased quantity adds to stock — recorded in the ledger.
          await applyStockMovement(tx, {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: Number(item.qty) || 0,
            dateStr: purchaseDateStr,
            referenceId: purchase.id,
            referenceType: 'PURCHASE',
            remarks: `Purchase ${invoiceNo}`,
          });
        }
      }

      const paymentMode = await tx.canteenPaymentMode.findUnique({
        where: { id: data.paymentModeId }
      });

      if (paymentMode && paymentMode.name.toLowerCase() !== 'credit' && totalAmount > 0) {
        let paymentNo = '';

        for (let attempt = 0; attempt < 10; attempt += 1) {
          paymentNo = await this.generateUniqueReferenceNumber({
            tx,
            modelName: 'canteenSupplierPayment',
            fieldName: 'paymentNo',
            prefix: 'PAY',
            startAt: attempt + 1,
          });

          try {
            await tx.canteenSupplierPayment.create({
              data: {
                paymentNo,
                date: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
                supplierId: data.supplierId,
                amount: totalAmount,
                paymentType: paymentMode.name,
                reference: `Auto-payment for ${invoiceNo}`,
                remarks: JSON.stringify({
                  userRemarks: `Purchase ${invoiceNo} paid via ${paymentMode.name}`,
                  bills: [{ entryNo: invoiceNo, date: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : new Date().toISOString(), amount: totalAmount }]
                })
              }
            });
            break;
          } catch (error) {
            if (this.isUniqueConstraintError(error, 'paymentNo')) {
              continue;
            }
            throw error;
          }
        }
      }

      return purchase;
    });
  }

  async deletePurchase(id: string) {
    const purchase = await this.prisma.canteenPurchase.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!purchase) throw new NotFoundException('Purchase entry not found');

    return this.prisma.$transaction(async (tx: any) => {
      // Delete the purchase (items cascade via onDelete: Cascade - delete items first for safety)
      await tx.canteenPurchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.canteenPurchase.delete({ where: { id } });

      // REVERSE: undo the exact ledger movements this purchase created so the
      // stock balance (and every historical "as on" figure) stays consistent.
      await reverseMovementsForReference(tx, 'PURCHASE', id);

      // Restore each linked product's costPrice to its latest remaining
      // purchase price (or 0 when no other purchase exists).
      for (const item of purchase.items) {
        if (item.productId) {
          const latest = await tx.canteenPurchaseItem.findFirst({
            where: { productId: item.productId },
            orderBy: { createdAt: 'desc' },
          });
          await tx.canteenProduct.update({
            where: { id: item.productId },
            data: { costPrice: latest ? Number(latest.price) || 0 : 0 },
          });
        }
      }
      return { message: 'Purchase entry deleted and product cost reversed.' };
    });
  }

  async updatePurchase(id: string, data: {
    supplierId?: string;
    paymentModeId?: string;
    notes?: string;
    purchaseDate?: string;
    items: Array<{
      productId?: string;
      productName: string;
      qty: number;
      unit?: string;
      price: number;
    }>;
  }) {
    const existing = await this.prisma.canteenPurchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Purchase entry not found');

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Purchase entry must contain at least one item.');
    }

    let totalAmount = 0;
    const itemDataList: any[] = [];

    for (const item of data.items) {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      if (!item.productName || item.productName.trim() === '' || qty <= 0) {
        throw new BadRequestException('Each item must have a product name and quantity > 0.');
      }
      const totalItemAmt = qty * price;
      totalAmount += totalItemAmt;

      itemDataList.push({
        productId: item.productId || null,
        productName: item.productName.trim(),
        qty,
        unit: item.unit || null,
        price,
        totalAmount: totalItemAmt
      });
    }

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.canteenPurchase.update({
        where: { id },
        data: {
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          supplierId: data.supplierId !== undefined ? (data.supplierId || null) : undefined,
          paymentModeId: data.paymentModeId !== undefined ? (data.paymentModeId || null) : undefined,
          totalAmount,
          notes: data.notes !== undefined ? (data.notes || null) : undefined,
        },
      });

      // Reverse the ledger movements previously created by this purchase, then
      // re-apply the new line items. This keeps exactly one movement per line
      // item (no duplicates) while rebuilding historical balances correctly.
      await reverseMovementsForReference(tx, 'PURCHASE', id);

      // Replace line items (delete + recreate keeps logic simple & atomic)
      await tx.canteenPurchaseItem.deleteMany({ where: { purchaseId: id } });
      for (const itemData of itemDataList) {
        await tx.canteenPurchaseItem.create({
          data: { ...itemData, purchaseId: id },
        });
      }

      // Apply the stock added by the new line items via the ledger.
      const newPurchaseDateStr = toDateStr(data.purchaseDate ? new Date(data.purchaseDate) : existing.purchaseDate);
      for (const itemData of itemDataList) {
        if (itemData.productId) {
          await applyStockMovement(tx, {
            productId: itemData.productId,
            type: 'PURCHASE',
            quantity: Number(itemData.qty) || 0,
            dateStr: newPurchaseDateStr,
            referenceId: id,
            referenceType: 'PURCHASE',
            remarks: `Purchase ${existing.invoiceNo}`,
          });
        }
      }

      // REVERSE + RE-APPLY cost: for every product touched by old OR new
      // items, set costPrice to its latest remaining purchase price.
      const touched = new Set<string>();
      for (const it of existing.items) if ((it as any).productId) touched.add((it as any).productId);
      for (const it of itemDataList) if (it.productId) touched.add(it.productId);

      for (const productId of touched) {
        const latest = await tx.canteenPurchaseItem.findFirst({
          where: { productId },
          orderBy: { createdAt: 'desc' },
        });
        await tx.canteenProduct.update({
          where: { id: productId },
          data: { costPrice: latest ? Number((latest as any).price) || 0 : 0 },
        });
      }

      return tx.canteenPurchase.findUnique({
        where: { id },
        include: { supplier: true, paymentMode: true, items: true },
      });
    });
  }

  // ---------------------------------------------------------
  // SUPPLIER PAYMENTS & PAYOUTS
  // ---------------------------------------------------------
  async getSupplierPayments() {
    return this.prisma.canteenSupplierPayment.findMany({
      include: {
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getNextPaymentNo() {
    const paymentNo = await this.generateUniqueReferenceNumber({
      modelName: 'canteenSupplierPayment',
      fieldName: 'paymentNo',
      prefix: 'PAY',
    });
    return { paymentNo };
  }

  async getSupplierBalance(supplierId: string) {
    const purchases = await this.prisma.canteenPurchase.aggregate({
      where: { supplierId },
      _sum: { totalAmount: true }
    });
    const payments = await this.prisma.canteenSupplierPayment.aggregate({
      where: { supplierId },
      _sum: { amount: true }
    });
    
    const totalPurchases = purchases._sum.totalAmount || 0;
    const totalPayments = payments._sum.amount || 0;
    
    return { balance: totalPurchases - totalPayments };
  }

  async getUnpaidBills(supplierId: string) {
    const purchases = await this.prisma.canteenPurchase.findMany({
      where: { supplierId },
      orderBy: { purchaseDate: 'asc' }
    });
    
    const payments = await this.prisma.canteenSupplierPayment.aggregate({
      where: { supplierId },
      _sum: { amount: true }
    });
    
    let totalPaid = payments._sum.amount || 0;
    
    const bills = purchases.map(p => {
      const received = Math.min(p.totalAmount, totalPaid);
      totalPaid = Math.max(0, totalPaid - received);
      const pending = p.totalAmount - received;
      
      return {
        entryNo: p.invoiceNo,
        date: p.purchaseDate,
        total: p.totalAmount,
        returned: 0,
        received,
        pending
      };
    });
    
    return bills;
  }

  async createSupplierPayment(data: {
    paymentNo: string;
    date: string;
    supplierId: string;
    amount: number;
    paymentType: string;
    reference?: string;
    remarks?: string;
  }) {
    if (!data.supplierId) throw new BadRequestException('Supplier is required');
    if (!data.paymentType) throw new BadRequestException('Payment Type is required');
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Amount must be greater than 0');

    let paymentNo = data.paymentNo;
    if (!paymentNo || paymentNo === 'Generating...') {
      paymentNo = await this.generateUniqueReferenceNumber({
        modelName: 'canteenSupplierPayment',
        fieldName: 'paymentNo',
        prefix: 'PAY',
      });
    }

    return this.prisma.canteenSupplierPayment.create({
      data: {
        paymentNo,
        date: data.date ? new Date(data.date) : new Date(),
        supplierId: data.supplierId,
        amount: Number(data.amount),
        paymentType: data.paymentType,
        reference: data.reference,
        remarks: data.remarks
      },
      include: {
        supplier: true
      }
    });
  }
}
