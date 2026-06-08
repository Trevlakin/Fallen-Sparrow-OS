/**
 * Sprint 8R: QuickBooks Online integration boundary.
 * THE ONLY FILE that imports node-quickbooks and intuit-oauth.
 */
import OAuthClient from "intuit-oauth";
import QuickBooks from "node-quickbooks";
import { env, hasQuickBooksConfig } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import type { QuickBooksPurchase } from "node-quickbooks";

export interface QuickBooksTokenPayload {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface QuickBooksPurchaseRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  vendor: string;
  accountName: string;
  paymentMethod: string;
}

function requireQuickBooksConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
} {
  if (!hasQuickBooksConfig()) {
    throw new AppError(
      "QuickBooks is not configured. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, and QBO_ENVIRONMENT.",
      503,
    );
  }
  return {
    clientId: env.QBO_CLIENT_ID!,
    clientSecret: env.QBO_CLIENT_SECRET!,
    redirectUri: env.QBO_REDIRECT_URI!,
    environment: env.QBO_ENVIRONMENT!,
  };
}

function createOAuthClient(): OAuthClient {
  const config = requireQuickBooksConfig();
  return new OAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: config.environment,
    redirectUri: config.redirectUri,
    logging: false,
  });
}

function isSandbox(): boolean {
  return env.QBO_ENVIRONMENT === "sandbox";
}

function apiHost(): string {
  return isSandbox()
    ? "sandbox-quickbooks.api.intuit.com"
    : "quickbooks.api.intuit.com";
}

function createQuickBooksClient(
  accessToken: string,
  realmId: string,
): QuickBooks {
  const config = requireQuickBooksConfig();
  return new QuickBooks(
    config.clientId,
    config.clientSecret,
    accessToken,
    false,
    realmId,
    isSandbox(),
    false,
    null,
    "2.0",
    null,
  );
}

function wrapQuickBooksError(err: unknown, message: string): AppError {
  if (err instanceof AppError) {
    return err;
  }
  const detail =
    err instanceof Error ? err.message : "Unknown QuickBooks API error";
  return new AppError(`${message}: ${detail}`, 502);
}

export function buildAuthorizationUrl(state: string): string {
  const oauthClient = createOAuthClient();
  return oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId,
      OAuthClient.scopes.Profile,
      OAuthClient.scopes.Email,
    ],
    state,
  });
}

export async function exchangeAuthorizationCode(
  callbackUrl: string,
): Promise<QuickBooksTokenPayload> {
  try {
    const oauthClient = createOAuthClient();
    const authResponse = await oauthClient.createToken(callbackUrl);
    const tokenData = authResponse.getJson() as {
      access_token?: string;
      refresh_token?: string;
      realmId?: string;
      expires_in?: number;
      x_refresh_token_expires_in?: number;
    };

    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new AppError("QuickBooks OAuth response missing tokens", 502);
    }

    const realmId =
      tokenData.realmId ??
      new URL(callbackUrl).searchParams.get("realmId") ??
      env.QBO_REALM_ID ??
      "";

    if (!realmId) {
      throw new AppError(
        "QuickBooks OAuth response missing realmId. Reconnect and approve company access.",
        502,
      );
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      realmId,
      expiresIn: tokenData.expires_in ?? 3600,
      refreshExpiresIn: tokenData.x_refresh_token_expires_in ?? 8726400,
    };
  } catch (err) {
    throw wrapQuickBooksError(err, "QuickBooks OAuth callback failed");
  }
}

export async function refreshQuickBooksTokens(
  refreshToken: string,
  realmId: string,
): Promise<QuickBooksTokenPayload> {
  try {
    const oauthClient = createOAuthClient();
    oauthClient.setToken({
      refresh_token: refreshToken,
      token_type: "bearer",
    });
    const authResponse = await oauthClient.refreshUsingToken(refreshToken);
    const tokenData = authResponse.getJson() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      x_refresh_token_expires_in?: number;
    };

    if (!tokenData.access_token) {
      throw new AppError("QuickBooks token refresh failed", 502);
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? refreshToken,
      realmId,
      expiresIn: tokenData.expires_in ?? 3600,
      refreshExpiresIn: tokenData.x_refresh_token_expires_in ?? 8726400,
    };
  } catch (err) {
    throw wrapQuickBooksError(err, "QuickBooks token refresh failed");
  }
}

export async function fetchCompanyName(
  accessToken: string,
  realmId: string,
): Promise<string | undefined> {
  try {
    const qbo = createQuickBooksClient(accessToken, realmId);
    const companyInfo = await new Promise<{ CompanyName?: string }>(
      (resolve, reject) => {
        qbo.getCompanyInfo(realmId, (err, info) => {
          if (err) reject(err);
          else resolve(info);
        });
      },
    );
    return companyInfo.CompanyName;
  } catch {
    return undefined;
  }
}

function normalizePurchase(purchase: QuickBooksPurchase): QuickBooksPurchaseRecord | null {
  if (!purchase.Id || !purchase.TxnDate) {
    return null;
  }
  const amount = Number.parseFloat(String(purchase.TotalAmt ?? "0"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const vendor =
    purchase.EntityRef?.name ??
    purchase.PaymentMethodRef?.name ??
    "Unknown vendor";
  const accountName = purchase.AccountRef?.name ?? "Other";
  const description =
    purchase.PrivateNote ??
    purchase.Line?.[0]?.Description ??
    "QuickBooks transaction";

  return {
    id: purchase.Id,
    date: purchase.TxnDate,
    description,
    amount,
    vendor,
    accountName,
    paymentMethod: purchase.PaymentType ?? "Card",
  };
}

export async function fetchPurchases(
  accessToken: string,
  realmId: string,
  startDate: string,
  endDate: string,
): Promise<QuickBooksPurchaseRecord[]> {
  try {
    const qbo = createQuickBooksClient(accessToken, realmId);
    const purchases = await new Promise<QuickBooksPurchase[]>((resolve, reject) => {
      qbo.findPurchases(
        [
          { field: "TxnDate", value: startDate, operator: ">=" },
          { field: "TxnDate", value: endDate, operator: "<=" },
        ],
        (err, data) => {
          if (err) reject(err);
          else resolve(data?.QueryResponse?.Purchase ?? []);
        },
      );
    });

    return purchases
      .map(normalizePurchase)
      .filter((record): record is QuickBooksPurchaseRecord => record !== null);
  } catch (err) {
    throw wrapQuickBooksError(err, "QuickBooks purchase sync failed");
  }
}

export async function fetchProfitAndLossReport(
  accessToken: string,
  realmId: string,
  startDate: string,
  endDate: string,
): Promise<unknown> {
  try {
    const url = `https://${apiHost()}/v3/company/${realmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&accounting_method=Accrual`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new AppError(
        `QuickBooks P&L request failed: ${response.statusText}`,
        502,
      );
    }

    return response.json();
  } catch (err) {
    throw wrapQuickBooksError(err, "QuickBooks P&L request failed");
  }
}

export async function fetchAccounts(
  accessToken: string,
  realmId: string,
): Promise<{ id: string; name: string }[]> {
  try {
    const qbo = createQuickBooksClient(accessToken, realmId);
    const accounts = await new Promise<{ Id?: string; Name?: string }[]>(
      (resolve, reject) => {
        qbo.findAccounts({}, (err, data) => {
          if (err) reject(err);
          else resolve(data?.QueryResponse?.Account ?? []);
        });
      },
    );

    return accounts
      .filter((account): account is { Id: string; Name: string } =>
        Boolean(account.Id && account.Name),
      )
      .map((account) => ({
        id: account.Id,
        name: account.Name,
      }));
  } catch (err) {
    throw wrapQuickBooksError(err, "QuickBooks account list failed");
  }
}
