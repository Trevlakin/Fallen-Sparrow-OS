import { describe, expect, it } from "vitest";
import { parsePorterAppointmentDateTime } from "@fallen-sparrow/shared/dates";
import {
  findPorterDataStart,
  inferServiceTypeFromPorterArtist,
  isPorterAppointmentTransactionsExport,
} from "@fallen-sparrow/shared/porterCsv";
import {
  preparePorterTransactionsCsv,
} from "../../src/services/porterTransactionsImportService.js";

const SAMPLE_PORTER_CSV = `Title: Porter Appointment Transactions
Date Range: 06/01/2026 - 06/15/2026

Artist,Customer,Apt. Date,Total Cash,Total Digital,Total Credit,Total Gift Card,Sales Tax,Refunded Amount,Voided Amount,Deposit,Reschedule Fees Paid,Checkout,Tip,Amount Sent to Artist,Amount Sent to Shop,Total Fees
Legion,Jane Doe,06/09/26 12:00 PM,500,75,0,0,0,0,0,Deposit not paid,,No checkout,50,330,295,0
Taylor,John Smith,06/10/26 3:00 PM,0,0,0,0,0,0,0,,,No checkout,0,0,0,0
JR,Bob Lee,06/11/26 10:30 AM,200,0,0,0,8,0,0,,,$200 paid,20,120,80,0
`;

describe("porterCsv shared utils", () => {
  it("detects Porter Appointment Transactions export", () => {
    expect(isPorterAppointmentTransactionsExport(SAMPLE_PORTER_CSV)).toBe(true);
    expect(isPorterAppointmentTransactionsExport("Date,Artist\n1,2")).toBe(false);
  });

  it("skips junk header rows before Artist column", () => {
    const cleaned = findPorterDataStart(SAMPLE_PORTER_CSV);
    expect(cleaned.startsWith("Artist,")).toBe(true);
    expect(cleaned).not.toContain("Title: Porter");
  });

  it("parses Porter datetime in Eastern time", () => {
    const parsed = parsePorterAppointmentDateTime("06/09/26 12:00 PM");
    expect(parsed).not.toBeNull();
    expect(parsed!.toLocaleString("en-US", { timeZone: "America/New_York" })).toContain(
      "6/9/2026",
    );
  });

  it("maps Taylor to laser service type", () => {
    expect(inferServiceTypeFromPorterArtist("Taylor")).toBe("laser");
    expect(inferServiceTypeFromPorterArtist("Legion")).toBe("tattoo");
  });
});

describe("porterTransactionsImportService", () => {
  it("preparePorterTransactionsCsv strips title rows", () => {
    const prepared = preparePorterTransactionsCsv(SAMPLE_PORTER_CSV);
    expect(prepared.split("\n")[0]).toMatch(/^Artist,/);
  });
});
