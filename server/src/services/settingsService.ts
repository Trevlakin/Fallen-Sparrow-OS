import { COMMISSION_TIERS, getCommissionRate } from "@fallen-sparrow/shared/constants";
import * as settingsRepo from "../repos/settingsRepo.js";
import { AppError } from "../utils/errors.js";

export interface CommissionTierRecord {
  thresholdAmount: number;
  artistPct: number;
  shopPct: number;
  sortOrder: number;
}

export interface CommissionTiersSetting {
  tiers: CommissionTierRecord[];
  updatedAt: string | null;
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
  walkInBonus: number;
  referralBonus: number;
  timezone: string;
  briefingHour: number;
  nudgeGapDays: number;
};

const COMMISSION_TIERS_KEY = "commission_tiers";
const BONUS_AMOUNTS_KEY = "bonus_amounts";
const SHOP_OPERATIONAL_KEY = "shop_operational";

const DEFAULT_COMMISSION_TIERS: CommissionTiersSetting = {
  tiers: COMMISSION_TIERS.map((tier, index) => ({
    thresholdAmount: tier.threshold,
    artistPct: tier.artistPct * 100,
    shopPct: tier.shopPct * 100,
    sortOrder: index + 1,
  })),
  updatedAt: null,
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

function sortTiers(tiers: CommissionTierRecord[]): CommissionTierRecord[] {
  return [...tiers].sort((a, b) => a.thresholdAmount - b.thresholdAmount);
}

function normalizeTierRecord(
  tier: { thresholdAmount: number; artistPct: number; shopPct?: number },
  sortOrder: number,
): CommissionTierRecord {
  const artistPct = Math.round(tier.artistPct * 100) / 100;
  const shopPct =
    tier.shopPct !== undefined
      ? Math.round(tier.shopPct * 100) / 100
      : Math.round((100 - artistPct) * 100) / 100;
  return {
    thresholdAmount: tier.thresholdAmount,
    artistPct,
    shopPct,
    sortOrder,
  };
}

// shopId reserved for multi-location; single-tenant uses global settings keys.
export async function getShopSettings(_shopId: string): Promise<FallenSparrowSettings> {
  const [bonuses, operational] = await Promise.all([
    getBonusAmounts(),
    getShopOperational(),
  ]);

  return {
    walkInBonus: bonuses.walkInBonus,
    referralBonus: bonuses.referralBonus,
    timezone: operational.timezone,
    briefingHour: operational.briefingHour,
    nudgeGapDays: operational.nudgeGapDays,
  };
}

export async function upsertShopSettings(
  _shopId: string,
  updates: Partial<FallenSparrowSettings>,
): Promise<FallenSparrowSettings> {
  const current = await getShopSettings(_shopId);
  const merged: FallenSparrowSettings = { ...current, ...updates };

  await Promise.all([
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

export async function getCommissionTiers(): Promise<CommissionTiersSetting> {
  const stored = await settingsRepo.getSetting<CommissionTiersSetting>(
    COMMISSION_TIERS_KEY,
  );
  if (!stored?.tiers?.length) {
    return DEFAULT_COMMISSION_TIERS;
  }
  return {
    tiers: sortTiers(stored.tiers),
    updatedAt: stored.updatedAt ?? null,
  };
}

export async function upsertCommissionTiers(
  input: Array<{ thresholdAmount: number; artistPct: number }>,
): Promise<CommissionTiersSetting> {
  if (input.length === 0) {
    throw new AppError("At least one commission tier is required", 400);
  }

  const tiers = sortTiers(
    input.map((tier, index) => {
      if (!Number.isFinite(tier.thresholdAmount) || tier.thresholdAmount < 0) {
        throw new AppError("Threshold amount must be zero or greater", 400);
      }
      if (!Number.isFinite(tier.artistPct) || tier.artistPct < 0 || tier.artistPct > 100) {
        throw new AppError("Artist share must be between 0 and 100", 400);
      }
      return normalizeTierRecord(
        {
          thresholdAmount: tier.thresholdAmount,
          artistPct: tier.artistPct,
        },
        index + 1,
      );
    }),
  );

  const payload: CommissionTiersSetting = {
    tiers,
    updatedAt: new Date().toISOString(),
  };
  await settingsRepo.upsertSetting(COMMISSION_TIERS_KEY, payload);
  return payload;
}

export async function getCommissionTierInputs() {
  const { tiers } = await getCommissionTiers();
  return tiers.map((tier) => ({
    thresholdAmount: tier.thresholdAmount,
    artistPct: tier.artistPct,
    shopPct: tier.shopPct,
  }));
}

/** Session payout rate from tiered settings (never flat per service type). */
export async function getSessionCommissionRate(
  sessionAmount: number,
): Promise<{ artistPct: number; shopPct: number }> {
  const tierInputs = await getCommissionTierInputs();
  return getCommissionRate(sessionAmount, tierInputs);
}

async function getShopOperational(): Promise<ShopOperationalSetting> {
  const stored = await settingsRepo.getSetting<ShopOperationalSetting>(
    SHOP_OPERATIONAL_KEY,
  );
  return stored ?? DEFAULT_OPERATIONAL;
}

export async function getBonusAmounts(): Promise<BonusSettings> {
  const stored = await settingsRepo.getSetting<BonusSettings>(BONUS_AMOUNTS_KEY);
  return stored ?? DEFAULT_BONUS;
}
