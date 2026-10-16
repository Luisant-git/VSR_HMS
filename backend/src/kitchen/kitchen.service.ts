import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { applyStockMovement, reverseMovementsForReference } from '../canteen/stock-ledger';

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
  // STOCK REPORT — "Stock as on date" (closing balance)
  // ---------------------------------------------------------
  // The balance as on any date is the sum of every ledger movement
  // (opening / purchase / consumption / manual adjustment) dated on or
  // before that date. Because ALL stock changes are recorded, the figure
  // always tallies — even when stock was manually adjusted.
  async getStockReport(dateStr: string) {
    if (!dateStr) throw new BadRequestException('date query parameter is required');

    const products = await this.prisma.canteenProduct.findMany({
      where: { status: 'Active' },
      include: { unit: true, category: true },
      orderBy: { name: 'asc' },
    });

    const sums = await this.prisma.canteenStockMovement.groupBy({
      by: ['productId'],
      where: { dateStr: { lte: dateStr } },
      _sum: { quantity: true },
    });

    const asOnMap = new Map<string, number>();
    for (const row of sums) {
      asOnMap.set(row.productId, Number(row._sum.quantity) || 0);
    }

    const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

    return products.map((p) => {
      const currentStock = Number(p.availableStock) || 0;
      const stockAsOn = asOnMap.get(p.id) ?? 0;
      return {
        productId: p.id,
        name: p.name,
        code: p.code,
        category: p.category?.name || '—',
        unit: p.unit?.symbol || p.unit?.name || '',
        currentStock: round(currentStock),
        stockAsOn: round(stockAsOn),
      };
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

    // Transaction: create consumption + deduct FULL qty taken (gross).
    // Both net-consumed AND wastage physically leave the stock.
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

      // Deduct full quantity taken (gross = net + wastage) from product stock,
      // recording the movement in the stock ledger.
      await applyStockMovement(tx, {
        productId: data.productId,
        type: 'CONSUMPTION',
        quantity: -Number(data.quantityTaken),
        dateStr: data.dateStr,
        referenceId: consumption.id,
        referenceType: 'CONSUMPTION',
        remarks: `${data.mealType} consumption`,
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
      // Same product: only the gross delta needs to be available.
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

      // Undo the entry's previous movement, then record the new one. This
      // handles product switches and quantity changes in one consistent step
      // and keeps exactly one CONSUMPTION movement per entry.
      await reverseMovementsForReference(tx, 'CONSUMPTION', id);
      await applyStockMovement(tx, {
        productId: newProductId,
        type: 'CONSUMPTION',
        quantity: -newQty,
        dateStr: updated.dateStr,
        referenceId: id,
        referenceType: 'CONSUMPTION',
        remarks: `${updated.mealType} consumption`,
      });

      return updated;
    });
  }

  async deleteConsumption(id: string) {
    const existing = await this.prisma.kitchenConsumption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Consumption entry not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.kitchenConsumption.delete({ where: { id } });

      // Undo the ledger movement (restores the gross quantity that was deducted)
      await reverseMovementsForReference(tx, 'CONSUMPTION', id);

      return { message: 'Deleted successfully' };
    });
  }
}
