import { Prisma } from '@prisma/client';

/**
 * Stock ledger helpers.
 *
 * `CanteenProduct.availableStock` is a cached "live" balance; every change to
 * it MUST also be recorded here as a dated `CanteenStockMovement`, inside the
 * same transaction. The Stock Report then rebuilds the balance "as on" any
 * date by summing the ledger, which stays correct even for manual edits made
 * in Product Master.
 */

export type StockMovementType = 'OPENING' | 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT';

export type StockReferenceType = 'PURCHASE' | 'CONSUMPTION' | 'MANUAL' | 'MIGRATION';

/** Normalise any date value to a YYYY-MM-DD string (local time, no timezone shift). */
export function toDateStr(value: Date | string): string {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

type TxClient = Prisma.TransactionClient;

export interface ApplyStockMovementParams {
  productId: string;
  type: StockMovementType;
  /** Signed quantity: + increases stock, - decreases stock. */
  quantity: number;
  /** Business date (YYYY-MM-DD) used for "as on" reporting. */
  dateStr: string;
  referenceId?: string | null;
  referenceType?: StockReferenceType | null;
  remarks?: string | null;
}

/**
 * Apply a signed stock movement: update the cached `availableStock` and append
 * a ledger row. Both writes happen in the caller's transaction.
 * Returns the created movement (or null when there is nothing to record).
 */
export async function applyStockMovement(tx: TxClient, params: ApplyStockMovementParams) {
  const qty = round3(params.quantity);
  if (qty === 0) return null;

  const product = await tx.canteenProduct.findUnique({ where: { id: params.productId } });
  if (!product) return null;

  await tx.canteenProduct.update({
    where: { id: params.productId },
    data: { availableStock: round3((Number(product.availableStock) || 0) + qty) },
  });

  return tx.canteenStockMovement.create({
    data: {
      productId: params.productId,
      type: params.type,
      quantity: qty,
      dateStr: toDateStr(params.dateStr),
      referenceId: params.referenceId ?? null,
      referenceType: params.referenceType ?? null,
      remarks: params.remarks ?? null,
    },
  });
}

/**
 * Undo a previously recorded movement: restore its signed quantity to the
 * cached balance and delete the ledger row. Used when a purchase or a
 * consumption entry is edited/deleted so the ledger reflects current records.
 */
async function reverseStockMovement(tx: TxClient, movement: { id: string; productId: string; quantity: number }) {
  const product = await tx.canteenProduct.findUnique({ where: { id: movement.productId } });
  if (product) {
    await tx.canteenProduct.update({
      where: { id: movement.productId },
      data: { availableStock: round3((Number(product.availableStock) || 0) - (Number(movement.quantity) || 0)) },
    });
  }
  await tx.canteenStockMovement.delete({ where: { id: movement.id } }).catch(() => undefined);
}

/** Undo every ledger row attached to a given reference (purchase / consumption). */
export async function reverseMovementsForReference(
  tx: TxClient,
  referenceType: StockReferenceType,
  referenceId: string,
) {
  const movements = await tx.canteenStockMovement.findMany({
    where: { referenceType, referenceId },
  });
  for (const movement of movements) {
    await reverseStockMovement(tx, movement);
  }
  return movements;
}
