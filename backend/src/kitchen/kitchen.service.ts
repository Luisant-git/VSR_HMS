import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class KitchenService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------
  // GET PRODUCTS (Raw Materials from Canteen Products)
  // ---------------------------------------------------------
  async getProducts() {
    return this.prisma.canteenProduct.findMany({
      where: { status: 'Active' },
      include: { unit: true, category: true },
      orderBy: { name: 'asc' },
    });
  }

  // ---------------------------------------------------------
  // CONSUMPTION ENTRIES
  // ---------------------------------------------------------
  async getConsumptions(filters?: { dateStr?: string; mealType?: string; productId?: string; fromDate?: string; toDate?: string }) {
    const where: any = {};
    if (filters?.dateStr) where.dateStr = filters.dateStr;
    if (filters?.mealType) where.mealType = filters.mealType;
    if (filters?.productId) where.productId = filters.productId;
    if (filters?.fromDate || filters?.toDate) {
      where.dateStr = {};
      if (filters?.fromDate) where.dateStr.gte = filters.fromDate;
      if (filters?.toDate) where.dateStr.lte = filters.toDate;
    }

    return this.prisma.kitchenConsumption.findMany({
      where,
      include: {
        product: {
          include: { unit: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createConsumption(data: {
    dateStr: string;
    mealType: string;
    productId: string;
    quantityTaken: number;
    wastage?: number;
    remarks?: string;
    batchId?: string;
  }) {
    const product = await this.prisma.canteenProduct.findUnique({
      where: { id: data.productId },
      include: { unit: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const wastage = data.wastage || 0;
    const netConsumed = data.quantityTaken - wastage;
    const unitSymbol = product.unit?.symbol || product.unit?.name || 'Kg';

    if (data.quantityTaken > product.availableStock) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.availableStock} ${unitSymbol}, Requested: ${data.quantityTaken} ${unitSymbol}`
      );
    }

    // Transaction: create consumption + deduct stock
    return this.prisma.$transaction(async (tx) => {
      const consumption = await tx.kitchenConsumption.create({
        data: {
          dateStr: data.dateStr,
          date: new Date(data.dateStr),
          mealType: data.mealType,
          productId: data.productId,
          batchId: data.batchId || null,
          availableStock: product.availableStock,
          quantityTaken: data.quantityTaken,
          unit: unitSymbol,
          wastage,
          netConsumed,
          remarks: data.remarks || null,
        },
        include: {
          product: { include: { unit: true } },
        },
      });

      // Deduct stock from product
      await tx.canteenProduct.update({
        where: { id: data.productId },
        data: { availableStock: { decrement: data.quantityTaken } },
      });

      return consumption;
    });
  }

  async updateConsumption(
    id: string,
    data: {
      mealType?: string;
      productId?: string;
      dateStr?: string;
      quantityTaken?: number;
      wastage?: number;
      remarks?: string;
    }
  ) {
    const existing = await this.prisma.kitchenConsumption.findUnique({
      where: { id },
      include: { product: { include: { unit: true } } },
    });
    if (!existing) throw new NotFoundException('Consumption entry not found');

    const newQty = data.quantityTaken ?? existing.quantityTaken;
    const newWastage = data.wastage ?? existing.wastage;
    const netConsumed = newQty - newWastage;

    const productChanging = data.productId !== undefined && data.productId !== existing.productId;
    const newProductId = productChanging ? (data.productId as string) : existing.productId;

    // Resolve the target product (new one when switching raw material)
    let targetProduct: any = existing.product;
    if (productChanging) {
      const p = await this.prisma.canteenProduct.findUnique({
        where: { id: newProductId },
        include: { unit: true },
      });
      if (!p) throw new NotFoundException('Product not found');
      targetProduct = p;
    }
    const unitSymbol = targetProduct.unit?.symbol || targetProduct.unit?.name || 'Kg';

    if (productChanging) {
      // Whole quantity moves to the new product, so it must have enough stock.
      if (newQty > targetProduct.availableStock) {
        throw new BadRequestException(
          `Insufficient stock for ${targetProduct.name}. Available: ${targetProduct.availableStock} ${unitSymbol}, Requested: ${newQty} ${unitSymbol}`
        );
      }
    } else {
      // Same product: only the delta needs to be available.
      const qtyDelta = newQty - existing.quantityTaken;
      const currentStock = existing.product.availableStock;
      if (qtyDelta > 0 && qtyDelta > currentStock) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentStock} ${existing.unit}, Additional needed: ${qtyDelta} ${existing.unit}`
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.kitchenConsumption.update({
        where: { id },
        data: {
          mealType: data.mealType,
          productId: productChanging ? newProductId : undefined,
          dateStr: data.dateStr !== undefined ? data.dateStr : undefined,
          date: data.dateStr !== undefined ? new Date(data.dateStr) : undefined,
          quantityTaken: newQty,
          wastage: newWastage,
          netConsumed,
          unit: unitSymbol,
          availableStock: productChanging ? targetProduct.availableStock : undefined,
          remarks: data.remarks,
        },
        include: { product: { include: { unit: true } } },
      });

      if (productChanging) {
        // Restore the old product's stock, then deduct from the new product.
        await tx.canteenProduct.update({
          where: { id: existing.productId },
          data: { availableStock: { increment: existing.quantityTaken } },
        });
        await tx.canteenProduct.update({
          where: { id: newProductId },
          data: { availableStock: { decrement: newQty } },
        });
      } else {
        const qtyDelta = newQty - existing.quantityTaken;
        if (qtyDelta !== 0) {
          await tx.canteenProduct.update({
            where: { id: existing.productId },
            data: { availableStock: { decrement: qtyDelta } },
          });
        }
      }

      return updated;
    });
  }

  async deleteConsumption(id: string) {
    const existing = await this.prisma.kitchenConsumption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Consumption entry not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.kitchenConsumption.delete({ where: { id } });

      // Restore stock to product
      await tx.canteenProduct.update({
        where: { id: existing.productId },
        data: { availableStock: { increment: existing.quantityTaken } },
      });

      return { message: 'Deleted successfully' };
    });
  }
}
