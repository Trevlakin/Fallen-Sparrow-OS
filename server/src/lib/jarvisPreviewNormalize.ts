/**
 * Promote structured brain-dump suggestions into typed preview rows when possible,
 * so the review UI is not left with orphaned manual-review-only items.
 */
import { randomUUID } from "node:crypto";
import type { ExpenseCategoryKey } from "@fallen-sparrow/shared/constants";

interface BrainDumpSuggestion {
  rawText: string;
  parsedAs: string;
  reason: string;
}

interface BrainDumpParsed {
  expenses: Array<{
    vendor: string;
    amount: number;
    category: ExpenseCategoryKey;
    date: string;
    confidence: number;
    description: string;
  }>;
  tasks: Array<{
    description: string;
    type: "follow_up" | "staff_note" | "admin";
    dueDate: string | null | undefined;
    confidence: number;
  }>;
  incidents: Array<{
    description: string;
    date: string;
    confidence: number;
  }>;
  strategicNotes: Array<{
    content: string;
    confidence: number;
  }>;
  suggestions: BrainDumpSuggestion[];
}

export interface NormalizedJarvisPreview {
  expenses: Array<{
    id: string;
    vendor: string;
    description: string;
    amount: number;
    category: ExpenseCategoryKey;
    date: string;
    confidence: number;
  }>;
  tasks: Array<{
    id: string;
    description: string;
    taskType: "follow_up" | "staff_note" | "admin";
    dueDate: string | null;
    confidence: number;
  }>;
  incidents: Array<{
    id: string;
    description: string;
    date: string;
    confidence: number;
  }>;
  notes: Array<{
    id: string;
    content: string;
    confidence: number;
  }>;
  suggestions: Array<{
    id: string;
    rawText: string;
    parsedAs: string;
    reason: string;
  }>;
}

function extractDollarAmounts(text: string): number[] {
  const amounts: number[] = [];
  const pattern = /\$\s*(\d+(?:\.\d{1,2})?)|(?:^|\s)(\d+(?:\.\d{1,2})?)\s*(?:dollars?|total|bucks?)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[1] ?? match[2];
    if (raw) {
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value) && value > 0) amounts.push(value);
    }
  }
  return amounts;
}

function pickExpenseAmount(rawText: string, reason: string): number | null {
  const logged = reason.match(/logged at \$\s*(\d+(?:\.\d{1,2})?)/i);
  if (logged?.[1]) {
    const value = Number.parseFloat(logged[1]);
    if (value > 0) return value;
  }

  const shopShare = reason.match(/shop(?:'s)?\s+(?:share|portion|card)?\s*(?:of\s*)?\$\s*(\d+(?:\.\d{1,2})?)/i);
  if (shopShare?.[1]) {
    const value = Number.parseFloat(shopShare[1]);
    if (value > 0) return value;
  }

  const combined = `${rawText} ${reason}`;
  const amounts = extractDollarAmounts(combined);
  if (amounts.length === 0) return null;

  if (/split|between|each paid|shop card/i.test(combined) && amounts.length >= 2) {
    return Math.min(...amounts);
  }

  return amounts[amounts.length - 1] ?? null;
}

function inferVendor(rawText: string): string {
  const trimmed = rawText.trim();
  const beforeComma = trimmed.split(",")[0]?.trim();
  if (beforeComma && beforeComma.length <= 80) return beforeComma;
  return trimmed.slice(0, 80) || "Expense";
}

function inferExpenseCategory(text: string): ExpenseCategoryKey {
  const lower = text.toLowerCase();
  if (/supplies|gloves|ink|needle|steriliz/.test(lower)) return "SUPPLIES";
  if (/repair|fix|plumb|hvac|\bac\b|sink|maintenance|equipment/.test(lower)) return "MAINTENANCE";
  if (/payroll|wage|artist fee|contractor/.test(lower)) return "PAYROLL";
  if (/market|advertis|social media|promo/.test(lower)) return "MARKETING";
  if (/electric|water|internet|phone|utility/.test(lower)) return "UTILITIES";
  if (/furniture|chair|desk|equipment purchase/.test(lower)) return "FURNITURE";
  return "ADMIN";
}

function parseTaskType(parsedAs: string): "follow_up" | "staff_note" | "admin" {
  if (parsedAs.startsWith("task:")) {
    const t = parsedAs.slice(5);
    if (t === "follow_up" || t === "staff_note" || t === "admin") return t;
  }
  if (parsedAs === "follow_up" || parsedAs === "staff_note" || parsedAs === "admin") {
    return parsedAs;
  }
  return "admin";
}

function promoteSuggestion(
  s: BrainDumpSuggestion,
  todayISO: string,
): Pick<
  NormalizedJarvisPreview,
  "expenses" | "tasks" | "incidents" | "notes" | "suggestions"
> | null {
  const parsedAs = s.parsedAs.toLowerCase();

  if (parsedAs === "expense" || parsedAs.startsWith("expense")) {
    const amount = pickExpenseAmount(s.rawText, s.reason);
    if (amount === null) return null;

    const description = s.rawText.trim();
    const vendor = inferVendor(description);
    return {
      expenses: [
        {
          id: randomUUID(),
          vendor,
          description: description.length > 0 ? description : vendor,
          amount,
          category: inferExpenseCategory(`${description} ${s.reason}`),
          date: todayISO,
          confidence: 0.86,
        },
      ],
      tasks: [],
      incidents: [],
      notes: [],
      suggestions: [],
    };
  }

  if (parsedAs.startsWith("task:") || parsedAs === "task" || ["follow_up", "staff_note", "admin"].includes(parsedAs)) {
    return {
      expenses: [],
      tasks: [
        {
          id: randomUUID(),
          description: s.rawText.trim(),
          taskType: parseTaskType(s.parsedAs),
          dueDate: null,
          confidence: 0.86,
        },
      ],
      incidents: [],
      notes: [],
      suggestions: [],
    };
  }

  if (parsedAs === "incident") {
    return {
      expenses: [],
      tasks: [],
      incidents: [
        {
          id: randomUUID(),
          description: s.rawText.trim(),
          date: todayISO,
          confidence: 0.86,
        },
      ],
      notes: [],
      suggestions: [],
    };
  }

  if (parsedAs === "strategic_note" || parsedAs === "strategicnote") {
    return {
      expenses: [],
      tasks: [],
      incidents: [],
      notes: [
        {
          id: randomUUID(),
          content: s.rawText.trim(),
          confidence: 0.86,
        },
      ],
      suggestions: [],
    };
  }

  return null;
}

export function normalizeJarvisPreview(
  parsed: BrainDumpParsed,
  todayISO: string,
): NormalizedJarvisPreview {
  const result: NormalizedJarvisPreview = {
    expenses: parsed.expenses.map((e) => ({
      id: randomUUID(),
      vendor: e.vendor,
      description: e.description || e.vendor,
      amount: e.amount,
      category: e.category,
      date: e.date,
      confidence: e.confidence,
    })),
    tasks: parsed.tasks.map((t) => ({
      id: randomUUID(),
      description: t.description,
      taskType: t.type,
      dueDate: t.dueDate ?? null,
      confidence: t.confidence,
    })),
    incidents: parsed.incidents.map((i) => ({
      id: randomUUID(),
      description: i.description,
      date: i.date,
      confidence: i.confidence,
    })),
    notes: parsed.strategicNotes.map((n) => ({
      id: randomUUID(),
      content: n.content,
      confidence: n.confidence,
    })),
    suggestions: [],
  };

  for (const s of parsed.suggestions) {
    const promoted = promoteSuggestion(s, todayISO);
    if (promoted) {
      result.expenses.push(...promoted.expenses);
      result.tasks.push(...promoted.tasks);
      result.incidents.push(...promoted.incidents);
      result.notes.push(...promoted.notes);
    } else {
      result.suggestions.push({
        id: randomUUID(),
        rawText: s.rawText,
        parsedAs: s.parsedAs,
        reason: s.reason,
      });
    }
  }

  return result;
}
