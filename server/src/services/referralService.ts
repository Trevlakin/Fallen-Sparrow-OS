/**
 * MASTER_SPEC_v3 §6.4: natural referral recognition (no discount campaigns).
 */
import * as referralRepo from "../repos/referralRepo.js";

export async function getTopReferrers(limit: number) {
  return referralRepo.getTopReferrers(limit);
}

export async function getReferralCountForCustomer(customerId: string): Promise<number> {
  return referralRepo.getReferralCountForCustomer(customerId);
}

export async function getReferredCustomers(referrerCustomerId: string) {
  return referralRepo.getReferredCustomers(referrerCustomerId);
}
