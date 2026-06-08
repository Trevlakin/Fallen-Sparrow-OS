/**
 * Inventory data access (Sprint 8K).
 */
import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { InventoryCategoryKey } from "@fallen-sparrow/shared/constants";
import { inventoryItems, inventoryTransactions } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { AppError } from "../utils/errors.js";

export type InventoryCategory = InventoryCategoryKey;

export type InventoryTransactionType = "restock" | "use" | "adjustment" | "jarvis";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number | null;
  idealStock: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemInput {
  id?: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderThreshold?: number | null;
  idealStock?: number | null;
  notes?: string | null;
}

export interface InventoryTransactionRow {
  id: string;
  itemId: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

function mapItem(row: {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number | null;
  reorderThreshold: number | null;
  idealStock: number | null;
  notes: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    currentStock: row.currentStock ?? 0,
    reorderThreshold: row.reorderThreshold,
    idealStock: row.idealStock,
    notes: row.notes,
    isActive: row.isActive ?? true,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function statusSortSql() {
  return sql`CASE
    WHEN ${inventoryItems.currentStock} = 0 THEN 0
    WHEN ${inventoryItems.reorderThreshold} IS NOT NULL
      AND ${inventoryItems.currentStock} > 0
      AND ${inventoryItems.currentStock} <= ${inventoryItems.reorderThreshold} THEN 1
    ELSE 2
  END`;
}

export async function listInventoryItems(activeOnly = true): Promise<InventoryItem[]> {
  const condition = activeOnly ? eq(inventoryItems.isActive, true) : undefined;

  const query = db
    .select()
    .from(inventoryItems)
    .orderBy(statusSortSql(), asc(inventoryItems.category), asc(inventoryItems.name));

  const rows = condition ? await query.where(condition) : await query;
  return rows.map((row) => mapItem(row));
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const [row] = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);
  return row ? mapItem(row) : null;
}

export async function getLowStockItems(): Promise<InventoryItem[]> {
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.isActive, true),
        sql`${inventoryItems.reorderThreshold} IS NOT NULL`,
        sql`${inventoryItems.currentStock} > 0`,
        sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderThreshold}`,
      ),
    )
    .orderBy(
      sql`(${inventoryItems.currentStock}::float / NULLIF(${inventoryItems.reorderThreshold}, 0)) ASC`,
    );

  return rows.map((row) => mapItem(row));
}

export async function getOutOfStockItems(): Promise<InventoryItem[]> {
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.isActive, true), eq(inventoryItems.currentStock, 0)))
    .orderBy(asc(inventoryItems.name));

  return rows.map((row) => mapItem(row));
}

export async function upsertInventoryItem(data: InventoryItemInput): Promise<string> {
  const now = new Date();

  if (data.id) {
    const [updated] = await db
      .update(inventoryItems)
      .set({
        name: data.name,
        category: data.category,
        unit: data.unit,
        currentStock: data.currentStock,
        reorderThreshold: data.reorderThreshold ?? null,
        idealStock: data.idealStock ?? null,
        notes: data.notes ?? null,
        updatedAt: now,
      })
      .where(eq(inventoryItems.id, data.id))
      .returning({ id: inventoryItems.id });

    if (!updated) {
      throw new AppError("Inventory item not found", 404);
    }
    return updated.id;
  }

  const [inserted] = await db
    .insert(inventoryItems)
    .values({
      name: data.name,
      category: data.category,
      unit: data.unit,
      currentStock: data.currentStock,
      reorderThreshold: data.reorderThreshold ?? null,
      idealStock: data.idealStock ?? null,
      notes: data.notes ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: inventoryItems.id });

  if (!inserted) {
    throw new AppError("Failed to create inventory item", 500);
  }
  return inserted.id;
}

export async function softDeleteInventoryItem(id: string): Promise<void> {
  const [row] = await db
    .update(inventoryItems)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(inventoryItems.id, id))
    .returning({ id: inventoryItems.id });

  if (!row) {
    throw new AppError("Inventory item not found", 404);
  }
}

export async function adjustStock(params: {
  itemId: string;
  quantity: number;
  type: InventoryTransactionType;
  notes?: string;
  createdBy?: string;
}): Promise<{ newStock: number }> {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        id: inventoryItems.id,
        currentStock: inventoryItems.currentStock,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, params.itemId))
      .limit(1);

    if (!item) {
      throw new AppError("Inventory item not found", 404);
    }

    const previousStock = item.currentStock ?? 0;

    const [updated] = await tx
      .update(inventoryItems)
      .set({
        currentStock: sql`GREATEST(0, ${inventoryItems.currentStock} + ${params.quantity})`,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, params.itemId))
      .returning({ newStock: inventoryItems.currentStock });

    const newStock = updated?.newStock ?? Math.max(0, previousStock + params.quantity);

    await tx.insert(inventoryTransactions).values({
      itemId: params.itemId,
      type: params.type,
      quantity: params.quantity,
      previousStock,
      newStock,
      notes: params.notes ?? null,
      createdBy: params.createdBy ?? null,
    });

    return { newStock };
  });
}

export async function getItemTransactionHistory(
  itemId: string,
  limit: number,
): Promise<InventoryTransactionRow[]> {
  const rows = await db
    .select()
    .from(inventoryTransactions)
    .where(eq(inventoryTransactions.itemId, itemId))
    .orderBy(desc(inventoryTransactions.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    itemId: row.itemId,
    type: row.type,
    quantity: row.quantity,
    previousStock: row.previousStock,
    newStock: row.newStock,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export interface MonthlyTransactionAggregate {
  used: number;
  restocked: number;
  hitZero: boolean;
}

export async function getMonthlyTransactionAggregatesByItem(
  monthStart: Date,
  monthEnd: Date,
): Promise<Map<string, MonthlyTransactionAggregate>> {
  const rows = await db
    .select({
      itemId: inventoryTransactions.itemId,
      used: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} < 0 THEN ABS(${inventoryTransactions.quantity}) ELSE 0 END), 0)::int`,
      restocked: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} > 0 THEN ${inventoryTransactions.quantity} ELSE 0 END), 0)::int`,
      hitZero: sql<boolean>`BOOL_OR(${inventoryTransactions.newStock} = 0)`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        gte(inventoryTransactions.createdAt, monthStart),
        lte(inventoryTransactions.createdAt, monthEnd),
      ),
    )
    .groupBy(inventoryTransactions.itemId);

  const map = new Map<string, MonthlyTransactionAggregate>();
  for (const row of rows) {
    map.set(row.itemId, {
      used: row.used,
      restocked: row.restocked,
      hitZero: row.hitZero ?? false,
    });
  }
  return map;
}

export async function getPostMonthQuantitySumByItem(
  afterEnd: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      itemId: inventoryTransactions.itemId,
      total: sql<number>`COALESCE(SUM(${inventoryTransactions.quantity}), 0)::int`,
    })
    .from(inventoryTransactions)
    .where(gt(inventoryTransactions.createdAt, afterEnd))
    .groupBy(inventoryTransactions.itemId);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.itemId, row.total);
  }
  return map;
}

export async function countRestockEventsInPeriod(
  monthStart: Date,
  monthEnd: Date,
): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        gte(inventoryTransactions.createdAt, monthStart),
        lte(inventoryTransactions.createdAt, monthEnd),
        gt(inventoryTransactions.quantity, 0),
      ),
    );

  return row?.count ?? 0;
}

export async function findItemByName(name: string): Promise<InventoryItem | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const pattern = `%${trimmed}%`;
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.isActive, true),
        or(
          ilike(inventoryItems.name, pattern),
          ilike(inventoryItems.name, `${trimmed}%`),
        ),
      ),
    )
    .orderBy(
      sql`CASE
        WHEN lower(${inventoryItems.name}) = lower(${trimmed}) THEN 0
        WHEN ${inventoryItems.name} ILIKE ${`${trimmed}%`} THEN 1
        ELSE 2
      END`,
      asc(inventoryItems.name),
    )
    .limit(1);

  const row = rows[0];
  return row ? mapItem(row) : null;
}
