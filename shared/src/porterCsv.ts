/** Porter Appointment Transactions export (Reports → Appointment Transactions). */

export const PORTER_TRANSACTIONS_TITLE = "Porter Appointment Transactions";

export const PORTER_TRANSACTIONS_COLUMNS = {
  artist: "Artist",
  customer: "Customer",
  aptDate: "Apt. Date",
  totalCash: "Total Cash",
  totalDigital: "Total Digital",
  totalCredit: "Total Credit",
  totalGiftCard: "Total Gift Card",
  salesTax: "Sales Tax",
  refundedAmount: "Refunded Amount",
  voidedAmount: "Voided Amount",
  tip: "Tip",
  artistPayout: "Amount Sent to Artist",
  shopPayout: "Amount Sent to Shop",
} as const;

/** Laser tech in production Porter roster (all others default to tattoo). */
export const PORTER_LASER_ARTIST_NAMES = new Set(["Taylor"]);

export function isPorterAppointmentTransactionsExport(rawText: string): boolean {
  const firstLines = rawText.split(/\r?\n/).slice(0, 3);
  return firstLines.some((line) => line.includes(PORTER_TRANSACTIONS_TITLE));
}

export function findPorterDataStart(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith("Artist,") ||
      trimmed.startsWith('"Artist"') ||
      trimmed.startsWith('"Artist",')
    );
  });
  if (headerIndex === -1) {
    throw new Error(
      "Could not find Porter data headers. Is this a Porter Appointment Transactions export?",
    );
  }
  return lines.slice(headerIndex).join("\n");
}

export function inferServiceTypeFromPorterArtist(artistName: string): "tattoo" | "laser" {
  const normalized = artistName.trim().toLowerCase();
  for (const laserName of PORTER_LASER_ARTIST_NAMES) {
    if (normalized === laserName.toLowerCase()) {
      return "laser";
    }
  }
  return "tattoo";
}
