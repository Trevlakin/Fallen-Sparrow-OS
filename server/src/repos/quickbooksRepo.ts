/**
 * QuickBooks token and expense persistence (Sprint 8R).
 */
import { eq } from "drizzle-orm";
import { expenses, meta } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { decryptSecret, encryptSecret } from "../utils/tokenEncryption.js";
import * as settingsRepo from "./settingsRepo.js";

export const QUICKBOOKS_SETTINGS_KEY = "quickbooks_connection";

export interface QuickBooksConnectionRecord {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  tokenExpiresAt: string;
  refreshExpiresAt: string;
  connected: boolean;
  connectedAt: string;
  companyName?: string;
  lastSyncedAt?: string;
}

interface StoredQuickBooksConnection {
  accessTokenEnc: string;
  refreshTokenEnc: string;
  realmId: string;
  tokenExpiresAt: string;
  refreshExpiresAt: string;
  connected: boolean;
  connectedAt: string;
  companyName?: string;
  lastSyncedAt?: string;
}

function toStored(record: QuickBooksConnectionRecord): StoredQuickBooksConnection {
  return {
    accessTokenEnc: encryptSecret(record.accessToken),
    refreshTokenEnc: encryptSecret(record.refreshToken),
    realmId: record.realmId,
    tokenExpiresAt: record.tokenExpiresAt,
    refreshExpiresAt: record.refreshExpiresAt,
    connected: record.connected,
    connectedAt: record.connectedAt,
    companyName: record.companyName,
    lastSyncedAt: record.lastSyncedAt,
  };
}

function fromStored(stored: StoredQuickBooksConnection): QuickBooksConnectionRecord {
  return {
    accessToken: decryptSecret(stored.accessTokenEnc),
    refreshToken: decryptSecret(stored.refreshTokenEnc),
    realmId: stored.realmId,
    tokenExpiresAt: stored.tokenExpiresAt,
    refreshExpiresAt: stored.refreshExpiresAt,
    connected: stored.connected,
    connectedAt: stored.connectedAt,
    companyName: stored.companyName,
    lastSyncedAt: stored.lastSyncedAt,
  };
}

export async function getConnection(): Promise<QuickBooksConnectionRecord | null> {
  const stored = await settingsRepo.getSetting<StoredQuickBooksConnection>(
    QUICKBOOKS_SETTINGS_KEY,
  );
  if (!stored?.connected) {
    return null;
  }
  return fromStored(stored);
}

export async function saveConnection(
  record: QuickBooksConnectionRecord,
): Promise<void> {
  await settingsRepo.upsertSetting(QUICKBOOKS_SETTINGS_KEY, toStored(record));
}

export async function clearConnection(): Promise<void> {
  await settingsRepo.upsertSetting(QUICKBOOKS_SETTINGS_KEY, {
    accessTokenEnc: "",
    refreshTokenEnc: "",
    realmId: "",
    tokenExpiresAt: "",
    refreshExpiresAt: "",
    connected: false,
    connectedAt: "",
    companyName: undefined,
    lastSyncedAt: undefined,
  });
}

export async function updateLastSyncedAt(isoTimestamp: string): Promise<void> {
  const stored = await settingsRepo.getSetting<StoredQuickBooksConnection>(
    QUICKBOOKS_SETTINGS_KEY,
  );
  if (!stored) return;
  await settingsRepo.upsertSetting(QUICKBOOKS_SETTINGS_KEY, {
    ...stored,
    lastSyncedAt: isoTimestamp,
  });

  const metaRows = await db.select().from(meta).limit(1);
  if (metaRows[0]) {
    await db
      .update(meta)
      .set({ lastQbSync: new Date(isoTimestamp), updatedAt: new Date() })
      .where(eq(meta.id, metaRows[0].id));
  }
}

export interface UpsertQuickBooksExpenseInput {
  quickbooksId: string;
  description: string;
  amount: string;
  category: string;
  qbGlAccount: string;
  expenseDate: Date;
}

export async function upsertQuickBooksExpense(
  input: UpsertQuickBooksExpenseInput,
): Promise<void> {
  await db
    .insert(expenses)
    .values({
      description: input.description,
      amount: input.amount,
      category: input.category,
      qbGlAccount: input.qbGlAccount,
      qbSyncStatus: "synced",
      quickbooksId: input.quickbooksId,
      source: "quickbooks",
      expenseDate: input.expenseDate,
      aiConfidence: "1.00",
      needsReview: false,
    })
    .onConflictDoUpdate({
      target: expenses.quickbooksId,
      set: {
        description: input.description,
        amount: input.amount,
        category: input.category,
        qbGlAccount: input.qbGlAccount,
        expenseDate: input.expenseDate,
        updatedAt: new Date(),
      },
    });
}
