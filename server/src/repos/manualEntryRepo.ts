/**
 * Manual expense entry (Sprint 8H).
 */
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryKey,
} from "@fallen-sparrow/shared/constants";
import { expenses } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { AppError } from "../utils/errors.js";

export interface InsertManualExpenseInput {
  vendor: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: Date;
  loggedByUserId?: string;
  needsReview?: boolean;
}

function resolveCategoryKey(category: string): ExpenseCategoryKey {
  if (category in EXPENSE_CATEGORIES) {
    return category as ExpenseCategoryKey;
  }
  throw new AppError(`Invalid expense category: ${category}`, 400);
}

export async function insertManualExpense(
  data: InsertManualExpenseInput,
): Promise<string> {
  const categoryKey = resolveCategoryKey(data.category);
  const qbAccount = EXPENSE_CATEGORIES[categoryKey].qbAccount;
  const description = data.description.trim()
    ? `${data.vendor}: ${data.description.trim()}`
    : data.vendor;

  const rows = await db
    .insert(expenses)
    .values({
      loggedByUserId: data.loggedByUserId,
      description,
      amount: data.amount.toFixed(2),
      category: categoryKey,
      qbGlAccount: qbAccount,
      qbSyncStatus: "pending",
      aiConfidence: "1.00",
      needsReview: data.needsReview ?? false,
      expenseDate: data.expenseDate,
    })
    .returning({ id: expenses.id });

  const created = rows[0];
  if (!created) {
    throw new AppError("Failed to create expense", 500);
  }
  return created.id;
}
