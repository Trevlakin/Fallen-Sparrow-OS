import * as settingsRepo from "../repos/settingsRepo.js";

export interface CommissionRatesSetting {
  // TODO(Q1d): Confirm per-service commission rates with Legion before production.
  tattoo: number;
  piercing: number;
  laser: number;
  other: number;
  confirmRates: boolean;
}

export interface BonusSettings {
  // TODO(Q1d): Confirm walk-in and referral bonus amounts with Legion.
  walkInBonus: number;
  referralBonus: number;
}

export interface ShopOperationalSetting {
  timezone: string;
  briefingHour: number;
  nudgeGapDays: number;
}

export type FallenSparrowSettings = {
  commissionRates: Pick<
    CommissionRatesSetting,
    "tattoo" | "piercing" | "laser" | "other"
  >;
  walkInBonus: number;
  referralBonus: number;
  timezone: string;
  briefingHour: number;
  nudgeGapDays: number;
  confirmRates: boolean;
};

const COMMISSION_RATES_KEY = "commission_rates";
const BONUS_AMOUNTS_KEY = "bonus_amounts";
const SHOP_OPERATIONAL_KEY = "shop_operational";

const DEFAULT_COMMISSION_RATES: CommissionRatesSetting = {
  tattoo: 0.5,
  piercing: 0.5,
  laser: 0.5,
  other: 0.5,
  confirmRates: true,
};

const DEFAULT_BONUS: BonusSettings = {
  walkInBonus: 0,
  referralBonus: 0,
};

const DEFAULT_OPERATIONAL: ShopOperationalSetting = {
  timezone: "America/New_York",
  briefingHour: 6,
  nudgeGapDays: 30,
};

// shopId reserved for multi-location; single-tenant uses global settings keys.
export async function getShopSettings(_shopId: string): Promise<FallenSparrowSettings> {
  const [rates, bonuses, operational] = await Promise.all([
    getCommissionRates(),
    getBonusAmounts(),
    getShopOperational(),
  ]);

  const { confirmRates, ...commissionRates } = rates;
  return {
    commissionRates,
    walkInBonus: bonuses.walkInBonus,
    referralBonus: bonuses.referralBonus,
    timezone: operational.timezone,
    briefingHour: operational.briefingHour,
    nudgeGapDays: operational.nudgeGapDays,
    confirmRates,
  };
}

export async function upsertShopSettings(
  _shopId: string,
  updates: Partial<FallenSparrowSettings>,
): Promise<FallenSparrowSettings> {
  const current = await getShopSettings(_shopId);
  const merged: FallenSparrowSettings = { ...current, ...updates };

  const commissionPayload: CommissionRatesSetting = {
    ...merged.commissionRates,
    confirmRates: merged.confirmRates,
  };

  await Promise.all([
    settingsRepo.upsertSetting(COMMISSION_RATES_KEY, commissionPayload),
    settingsRepo.upsertSetting(BONUS_AMOUNTS_KEY, {
      walkInBonus: merged.walkInBonus,
      referralBonus: merged.referralBonus,
    } satisfies BonusSettings),
    settingsRepo.upsertSetting(SHOP_OPERATIONAL_KEY, {
      timezone: merged.timezone,
      briefingHour: merged.briefingHour,
      nudgeGapDays: merged.nudgeGapDays,
    } satisfies ShopOperationalSetting),
  ]);

  return merged;
}

async function getShopOperational(): Promise<ShopOperationalSetting> {
  const stored = await settingsRepo.getSetting<ShopOperationalSetting>(
    SHOP_OPERATIONAL_KEY,
  );
  return stored ?? DEFAULT_OPERATIONAL;
}

export async function getCommissionRate(
  serviceType: keyof Pick<
    CommissionRatesSetting,
    "tattoo" | "piercing" | "laser" | "other"
  >,
): Promise<number> {
  const stored = await settingsRepo.getSetting<CommissionRatesSetting>(
    COMMISSION_RATES_KEY,
  );
  if (!stored) return DEFAULT_COMMISSION_RATES[serviceType];
  return stored[serviceType];
}

export async function getCommissionRates(): Promise<CommissionRatesSetting> {
  const stored = await settingsRepo.getSetting<CommissionRatesSetting>(
    COMMISSION_RATES_KEY,
  );
  return stored ?? DEFAULT_COMMISSION_RATES;
}

export async function getBonusAmounts(): Promise<BonusSettings> {
  const stored = await settingsRepo.getSetting<BonusSettings>(BONUS_AMOUNTS_KEY);
  return stored ?? DEFAULT_BONUS;
}
