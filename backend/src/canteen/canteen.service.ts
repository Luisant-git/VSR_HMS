import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CanteenService {
  constructor(private prisma: PrismaService) {}

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
    stock?: number;
    status?: string;
  }) {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Product name is required.');
    }
    const name = data.name.trim();

    if (data.code && data.code.trim() !== '') {
      const code = data.code.trim();
      const existingCode = await this.prisma.canteenProduct.findUnique({ where: { code } });
      if (existingCode) throw new BadRequestException(`Product code/barcode "${code}" is already in use.`);
    }

    return this.prisma.canteenProduct.create({
      data: {
        name,
        code: data.code ? data.code.trim() : null,
        categoryId: data.categoryId || null,
        unitId: data.unitId || null,
        price: data.price !== undefined ? Number(data.price) : 0.0,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : 0.0,
        stock: data.stock !== undefined ? Number(data.stock) : 0.0,
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
    stock?: number;
    status?: string;
  }) {
    const existing = await this.prisma.canteenProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    if (data.code && data.code.trim() !== existing.code) {
      const code = data.code.trim();
      const clash = await this.prisma.canteenProduct.findUnique({ where: { code } });
      if (clash) throw new BadRequestException(`Product code "${code}" is already in use.`);
    }

    return this.prisma.canteenProduct.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        code: data.code !== undefined ? (data.code ? data.code.trim() : null) : undefined,
        categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
        unitId: data.unitId !== undefined ? (data.unitId || null) : undefined,
        price: data.price !== undefined ? Number(data.price) : undefined,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : undefined,
        stock: data.stock !== undefined ? Number(data.stock) : undefined,
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

    const count = await this.prisma.canteenPurchase.count();
    const invoiceNo = `PUR-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

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
      const purchase = await tx.canteenPurchase.create({
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

      for (const item of data.items) {
        if (item.productId) {
          await tx.canteenProduct.update({
            where: { id: item.productId },
            data: {
              stock: { increment: Number(item.qty) || 0 },
              costPrice: Number(item.price) || 0
            }
          });
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
      for (const item of purchase.items) {
        if (item.productId) {
          await tx.canteenProduct.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.qty }
            }
          });
        }
      }
      return tx.canteenPurchase.delete({ where: { id } });
    });
  }
}
