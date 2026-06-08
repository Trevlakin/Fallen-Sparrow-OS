/**
 * Expense aggregates for P&L (MASTER_SPEC_v3 Sprint 5B).
 * expenses table has no shopId; filter by expenseDate range only.
 */
import { and, desc, gte, lte, sql } from "drizzle-orm";
import { expenses } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal, roundMoney } from "../lib/profit.js";

export interface ExpenseCategoryTotal {
  category: string;
  total: number;
}

// shopId accepted for future multi-location; ignored in single-tenant deployment.
export async function sumExpensesByPeriod(
  _shopId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)::text`,
    })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)));

  return parseDecimal(rows[0]?.total);
}

export async function sumExpensesByCategory(
  _shopId: string,
  from: Date,
  to: Date,
): Promise<ExpenseCategoryTotal[]> {
  const rows = await db
    .select({
      category: expenses.category,
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)::text`,
    })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)))
    .groupBy(expenses.category);

  return rows.map((row) => ({
    category: row.category,
    total: parseDecimal(row.total),
  }));
}

export interface ExpenseLineItem {
  description: string;
  amount: number;
}

export interface ExpenseCategoryDetail {
  category: string;
  total: number;
  items: ExpenseLineItem[];
}

export async function listExpensesByCategory(
  _shopId: string,
  from: Date,
  to: Date,
): Promise<ExpenseCategoryDetail[]> {
  const rows = await db
    .select({
      category: expenses.category,
      description: expenses.description,
      amount: expenses.amount,
    })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)))
    .orderBy(expenses.category, desc(expenses.expenseDate));

  const map = new Map<string, ExpenseCategoryDetail>();
  for (const row of rows) {
    const amt = parseDecimal(row.amount);
    const existing = map.get(row.category);
    if (existing) {
      existing.total = roundMoney(existing.total + amt);
      existing.items.push({ description: row.description, amount: amt });
    } else {
      map.set(row.category, {
        category: row.category,
        total: roundMoney(amt),
        items: [{ description: row.description, amount: amt }],
      });
    }
  }
  return Array.from(map.values());
}

export interface RecentExpenseRow {
  vendor: string;
  amount: number;
  category: string;
}

export async function getRecentExpenses(
  since: Date,
  limit = 15,
): Promise<RecentExpenseRow[]> {
  const rows = await db
    .select({
      description: expenses.description,
      amount: expenses.amount,
      category: expenses.category,
    })
    .from(expenses)
    .where(gte(expenses.expenseDate, since))
    .orderBy(desc(expenses.expenseDate))
    .limit(limit);

  return rows.map((row) => ({
    vendor: row.description,
    amount: parseDecimal(row.amount),
    category: row.category,
  }));
}
