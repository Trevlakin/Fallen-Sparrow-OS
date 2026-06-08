declare module "node-quickbooks" {
  export interface QuickBooksPurchase {
    Id?: string;
    TxnDate?: string;
    TotalAmt?: string | number;
    PrivateNote?: string;
    PaymentType?: string;
    EntityRef?: { name?: string };
    PaymentMethodRef?: { name?: string };
    AccountRef?: { name?: string };
    Line?: { Description?: string }[];
  }

  export interface QuickBooksQueryResponse<T> {
    QueryResponse?: {
      Purchase?: T[];
      Account?: T[];
    };
  }

  export interface QuickBooksCompanyInfo {
    CompanyName?: string;
  }

  export default class QuickBooks {
    constructor(
      clientId: string,
      clientSecret: string,
      accessToken: string,
      useTokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: string | null,
      oauthVersion: string,
      refreshToken: string | null,
    );

    getCompanyInfo(
      realmId: string,
      callback: (err: Error | null, info: QuickBooksCompanyInfo) => void,
    ): void;

    findPurchases(
      criteria: { field: string; value: string; operator: string }[],
      callback: (
        err: Error | null,
        data: QuickBooksQueryResponse<QuickBooksPurchase>,
      ) => void,
    ): void;

    findAccounts(
      criteria: Record<string, unknown>,
      callback: (
        err: Error | null,
        data: QuickBooksQueryResponse<{ Id?: string; Name?: string }>,
      ) => void,
    ): void;
  }
}
