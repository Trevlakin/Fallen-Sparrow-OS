/**
 * Sprint 8R: QuickBooks OAuth, sync, and status business logic.
 */
import jwt from "jsonwebtoken";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryKey,
} from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  fetchAccounts,
  fetchCompanyName,
  fetchProfitAndLossReport,
  fetchPurchases,
  refreshQuickBooksTokens,
  type QuickBooksTokenPayload,
} from "../integrations/quickbooks.js";
import * as quickbooksRepo from "../repos/quickbooksRepo.js";
import { AppError } from "../utils/errors.js";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const OAUTH_STATE_TTL = "10m";

interface QuickBooksOAuthState {
  studioId: string;
  purpose: "qb_oauth";
}

export interface QuickBooksStatus {
  connected: boolean;
  lastSynced?: string;
  companyName?: string;
  configured: boolean;
}

export interface QuickBooksSyncResult {
  synced: number;
  errors: number;
}

function mapAccountNameToCategory(accountName: string): ExpenseCategoryKey {
  const name = accountName.toLowerCase();

  if (
    name.includes("utility") ||
    name.includes("electric") ||
    name.includes("gas") ||
    name.includes("water") ||
    name.includes("internet") ||
    name.includes("phone")
  ) {
    return "UTILITIES";
  }
  if (
    name.includes("supplies") ||
    name.includes("office") ||
    name.includes("materials") ||
    name.includes("ink") ||
    name.includes("needle")
  ) {
    return "SUPPLIES";
  }
  if (
    name.includes("equipment") ||
    name.includes("tools") ||
    name.includes("machinery") ||
    name.includes("furniture")
  ) {
    return "FURNITURE";
  }
  if (
    name.includes("payroll") ||
    name.includes("wages") ||
    name.includes("salary")
  ) {
    return "PAYROLL";
  }
  if (name.includes("marketing") || name.includes("advertising")) {
    return "MARKETING";
  }
  if (name.includes("repair") || name.includes("maintenance")) {
    return "MAINTENANCE";
  }
  if (
    name.includes("software") ||
    name.includes("subscription") ||
    name.includes("admin") ||
    name.includes("license") ||
    name.includes("permit")
  ) {
    return "ADMIN";
  }

  return "ADMIN";
}

function tokenPayloadToConnection(
  payload: QuickBooksTokenPayload,
  companyName?: string,
): quickbooksRepo.QuickBooksConnectionRecord {
  const now = new Date();
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    realmId: payload.realmId,
    tokenExpiresAt: new Date(
      now.getTime() + payload.expiresIn * 1000,
    ).toISOString(),
    refreshExpiresAt: new Date(
      now.getTime() + payload.refreshExpiresIn * 1000,
    ).toISOString(),
    connected: true,
    connectedAt: now.toISOString(),
    companyName,
  };
}

async function persistTokens(
  payload: QuickBooksTokenPayload,
  companyName?: string,
): Promise<void> {
  const existing = await quickbooksRepo.getConnection();
  const next = tokenPayloadToConnection(payload, companyName ?? existing?.companyName);
  if (existing?.lastSyncedAt) {
    next.lastSyncedAt = existing.lastSyncedAt;
  }
  await quickbooksRepo.saveConnection(next);
}

export function createOAuthState(studioId: string): string {
  const payload: QuickBooksOAuthState = {
    studioId,
    purpose: "qb_oauth",
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: OAUTH_STATE_TTL });
}

export function verifyOAuthState(state: string): QuickBooksOAuthState {
  try {
    const decoded = jwt.verify(state, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("Invalid QuickBooks OAuth state", 400);
    }
    const studioId = "studioId" in decoded ? decoded["studioId"] : undefined;
    const purpose = "purpose" in decoded ? decoded["purpose"] : undefined;
    if (typeof studioId !== "string" || purpose !== "qb_oauth") {
      throw new AppError("Invalid QuickBooks OAuth state", 400);
    }
    return { studioId, purpose: "qb_oauth" };
  } catch {
    throw new AppError("QuickBooks OAuth state expired or invalid", 400);
  }
}

export function getAuthorizationUrl(studioId: string): string {
  const state = createOAuthState(studioId);
  return buildAuthorizationUrl(state);
}

async function getValidAccessToken(): Promise<{
  accessToken: string;
  realmId: string;
}> {
  const connection = await quickbooksRepo.getConnection();
  if (!connection) {
    throw new AppError("QuickBooks is not connected", 400);
  }

  const expiresAt = new Date(connection.tokenExpiresAt).getTime();
  const needsRefresh = expiresAt < Date.now() + TOKEN_REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return {
      accessToken: connection.accessToken,
      realmId: connection.realmId,
    };
  }

  const refreshed = await refreshQuickBooksTokens(
    connection.refreshToken,
    connection.realmId,
  );
  const companyName = await fetchCompanyName(
    refreshed.accessToken,
    refreshed.realmId,
  );
  await persistTokens(refreshed, companyName ?? connection.companyName);
  return {
    accessToken: refreshed.accessToken,
    realmId: refreshed.realmId,
  };
}

export async function getConnectionStatus(): Promise<QuickBooksStatus> {
  const connection = await quickbooksRepo.getConnection();
  return {
    connected: Boolean(connection?.connected),
    lastSynced: connection?.lastSyncedAt,
    companyName: connection?.companyName,
    configured: Boolean(env.QBO_CLIENT_ID && env.QBO_CLIENT_SECRET),
  };
}

export async function handleOAuthCallback(
  callbackUrl: string,
): Promise<{ companyName?: string }> {
  const tokens = await exchangeAuthorizationCode(callbackUrl);
  const companyName = await fetchCompanyName(tokens.accessToken, tokens.realmId);
  await persistTokens(tokens, companyName);
  return { companyName };
}

export async function disconnectQuickBooks(): Promise<void> {
  await quickbooksRepo.clearConnection();
}

export async function syncExpenses(
  _studioId: string,
  startDate?: string,
  endDate?: string,
): Promise<QuickBooksSyncResult> {
  const { accessToken, realmId } = await getValidAccessToken();
  const start =
    startDate ??
    `${new Date().getFullYear()}-01-01`;
  const end = endDate ?? new Date().toISOString().split("T")[0]!;

  const purchases = await fetchPurchases(accessToken, realmId, start, end);

  let synced = 0;
  let errors = 0;

  for (const purchase of purchases) {
    try {
      const categoryKey = mapAccountNameToCategory(purchase.accountName);
      const categoryMeta = EXPENSE_CATEGORIES[categoryKey];
      const description = `${purchase.vendor}: ${purchase.description}`;

      await quickbooksRepo.upsertQuickBooksExpense({
        quickbooksId: purchase.id,
        description,
        amount: purchase.amount.toFixed(2),
        category: categoryKey,
        qbGlAccount: categoryMeta.qbAccount,
        expenseDate: new Date(purchase.date),
      });
      synced += 1;
    } catch {
      errors += 1;
    }
  }

  const syncedAt = new Date().toISOString();
  await quickbooksRepo.updateLastSyncedAt(syncedAt);

  return { synced, errors };
}

export async function getProfitAndLoss(
  _studioId: string,
  startDate: string,
  endDate: string,
): Promise<unknown> {
  const { accessToken, realmId } = await getValidAccessToken();
  return fetchProfitAndLossReport(accessToken, realmId, startDate, endDate);
}

export async function listQuickBooksAccounts(
  _studioId: string,
): Promise<{ id: string; name: string }[]> {
  const { accessToken, realmId } = await getValidAccessToken();
  return fetchAccounts(accessToken, realmId);
}
