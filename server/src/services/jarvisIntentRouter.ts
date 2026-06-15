/**
 * Sprint 8Q: route classified JARVIS input to query, command, or log handlers.
 */
import type { TeamCommandResult } from "./jarvisTeamCommandService.js";
import { classifyIntent, type ClassifiedIntent } from "./jarvisIntentClassifier.js";
import { handleQuery } from "./jarvisQueryEngine.js";
import * as jarvisTeamCommandService from "./jarvisTeamCommandService.js";
import * as quickbooksService from "./quickbooksService.js";
import {
  logExpenseDirect,
  logMaintenanceIncidentDirect,
  logStrategicNoteDirect,
  looksLikeMaintenanceIncident,
  looksLikeStrategicNote,
  queryFollowUps,
} from "./jarvisService.js";
import {
  proposeArtistPayoutFromJarvis,
  looksLikeArtistPayoutLog,
  type JarvisPayoutProposal,
} from "./jarvisArtistPayoutService.js";
import type { UserRole } from "@fallen-sparrow/shared/constants";
import { todayISOInTimezone } from "../lib/timezone.js";

export type JarvisResponseType =
  | "query_response"
  | "command_response"
  | "log_items"
  | "payout_proposal";

export interface JarvisIntentResponseBase {
  type: JarvisResponseType;
  intent: "QUERY" | "COMMAND" | "LOG";
  confidence: number;
  message: string;
  requiresApproval: boolean;
  expenses: [];
  tasks: [];
  incidents: [];
  notes: [];
  inventoryUpdates: [];
  suggestions: [];
}

export interface JarvisQueryResponse extends JarvisIntentResponseBase {
  type: "query_response";
  intent: "QUERY";
  requiresApproval: false;
  subType?: string;
}

export interface JarvisCommandResponse extends JarvisIntentResponseBase {
  type: "command_response";
  intent: "COMMAND";
  requiresApproval: false;
  teamCommand?: TeamCommandResult;
}

export interface JarvisPayoutProposalResponse extends JarvisIntentResponseBase {
  type: "payout_proposal";
  intent: "LOG";
  requiresApproval: true;
  subType: "artist_payout_log";
  payoutProposal: JarvisPayoutProposal;
}

const EMPTY_PREVIEW_ARRAYS = {
  expenses: [] as [],
  tasks: [] as [],
  incidents: [] as [],
  notes: [] as [],
  inventoryUpdates: [] as [],
  suggestions: [] as [],
};

function buildQueryResponse(
  message: string,
  confidence: number,
  subType?: string,
): JarvisQueryResponse {
  return {
    type: "query_response",
    intent: "QUERY",
    confidence,
    message,
    requiresApproval: false,
    ...EMPTY_PREVIEW_ARRAYS,
    subType,
  };
}

function buildCommandResponse(
  message: string,
  confidence: number,
  teamCommand?: TeamCommandResult,
): JarvisCommandResponse {
  return {
    type: "command_response",
    intent: "COMMAND",
    confidence,
    message,
    requiresApproval: false,
    ...EMPTY_PREVIEW_ARRAYS,
    teamCommand,
  };
}

const COMMAND_FALLBACK_MESSAGE =
  "• I understood you want to take an action but could not run it from that wording.\n• Try: \"Change Courtney's PIN to 5555\", \"Add Sarah to front desk\", or \"Deactivate Marcus\".";

function looksLikeQuickBooksSync(input: string): boolean {
  const normalized = input.toLowerCase();
  const mentionsQb =
    normalized.includes("quickbooks") ||
    normalized.includes("quick books") ||
    normalized.includes(" from qb") ||
    normalized.startsWith("qb ");
  const mentionsSync =
    normalized.includes("sync") ||
    normalized.includes("pull") ||
    normalized.includes("update");
  return mentionsQb && mentionsSync;
}

async function runQuickBooksSyncCommand(
  shopId: string,
  confidence: number,
): Promise<JarvisCommandResponse> {
  try {
    const result = await quickbooksService.syncExpenses(shopId);
    const message = `• Synced ${result.synced} transactions from QuickBooks${
      result.errors > 0 ? `\n• ${result.errors} transactions had errors` : ""
    }`;
    return buildCommandResponse(message, confidence);
  } catch {
    return buildCommandResponse(
      "• QuickBooks sync failed. Check your connection in Settings.",
      confidence,
    );
  }
}

function buildPayoutProposalResponse(
  proposal: JarvisPayoutProposal,
  confidence: number,
): JarvisPayoutProposalResponse {
  return {
    type: "payout_proposal",
    intent: "LOG",
    confidence,
    message: proposal.message,
    requiresApproval: true,
    ...EMPTY_PREVIEW_ARRAYS,
    subType: "artist_payout_log",
    payoutProposal: proposal,
  };
}

function buildExpenseLogResponse(
  message: string,
  confidence: number,
  editId: string,
  committed: boolean,
): JarvisQueryResponse {
  return {
    type: "query_response",
    intent: "QUERY",
    confidence,
    message: committed ? `${message}` : `${message}`,
    requiresApproval: false,
    ...EMPTY_PREVIEW_ARRAYS,
    subType: "expense_log",
    editId,
  } as JarvisQueryResponse & { editId: string };
}

function canLogArtistPayout(role: UserRole | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export async function routeClassifiedJarvisInput(
  classified: ClassifiedIntent,
  shopId: string,
  userId: string | undefined,
  timezone?: string,
  userRole?: UserRole,
): Promise<
  JarvisQueryResponse | JarvisCommandResponse | JarvisPayoutProposalResponse | null
> {
  if (classified.intent === "QUERY") {
    if (classified.subType === "follow_up_query" || classified.subType === "followup") {
      const message = await queryFollowUps(classified.subType);
      return buildQueryResponse(message, classified.confidence, "follow_up_query");
    }
    const message = await handleQuery(shopId, classified, timezone);
    return buildQueryResponse(message, classified.confidence, classified.subType);
  }

  if (
    classified.intent === "LOG" &&
    (classified.subType === "artist_payout_log" ||
      looksLikeArtistPayoutLog(classified.originalInput))
  ) {
    if (!canLogArtistPayout(userRole)) {
      return buildQueryResponse(
        "• Only owners and managers can log artist payouts via JARVIS.",
        classified.confidence,
        "artist_payout_log",
      );
    }
    try {
      const proposal = await proposeArtistPayoutFromJarvis(classified.originalInput);
      return buildPayoutProposalResponse(proposal, classified.confidence);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not match artist payout.";
      return buildQueryResponse(`• ${msg}`, classified.confidence, "artist_payout_log");
    }
  }

  if (classified.intent === "LOG" && classified.subType === "expense_log") {
    const tz = timezone ?? "America/New_York";
    const todayISO = todayISOInTimezone(tz);
    if (looksLikeMaintenanceIncident(classified.originalInput)) {
      try {
        const result = await logMaintenanceIncidentDirect(
          userId,
          classified.originalInput,
          todayISO,
        );
        return buildQueryResponse(result.message, classified.confidence, "incident_log");
      } catch {
        return null;
      }
    }
    try {
      const result = await logExpenseDirect(userId, classified.originalInput, todayISO);
      return buildExpenseLogResponse(result.message, classified.confidence, result.expenseId, result.committed);
    } catch {
      return null;
    }
  }

  if (
    classified.intent === "LOG" &&
    (classified.subType === "incident_log" || looksLikeMaintenanceIncident(classified.originalInput))
  ) {
    const tz = timezone ?? "America/New_York";
    const todayISO = todayISOInTimezone(tz);
    try {
      const result = await logMaintenanceIncidentDirect(
        userId,
        classified.originalInput,
        todayISO,
      );
      return buildQueryResponse(result.message, classified.confidence, "incident_log");
    } catch {
      return null;
    }
  }

  if (
    classified.intent === "LOG" &&
    (classified.subType === "strategic_note" || looksLikeStrategicNote(classified.originalInput))
  ) {
    try {
      const result = await logStrategicNoteDirect(userId, classified.originalInput);
      return buildQueryResponse(result.message, classified.confidence, "strategic_note");
    } catch {
      return null;
    }
  }

  if (classified.intent === "COMMAND") {
    if (
      classified.subType === "quickbooks_sync" ||
      looksLikeQuickBooksSync(classified.originalInput)
    ) {
      return runQuickBooksSyncCommand(shopId, classified.confidence);
    }

    const teamCommand = await jarvisTeamCommandService.tryExecuteTeamCommand(
      classified.originalInput,
      userId,
    );
    if (teamCommand) {
      return buildCommandResponse(
        teamCommand.message,
        classified.confidence,
        teamCommand,
      );
    }
    return buildCommandResponse(COMMAND_FALLBACK_MESSAGE, classified.confidence);
  }

  return null;
}

export async function tryRouteJarvisByIntent(
  rawText: string,
  shopId: string,
  userId: string | undefined,
  timezone?: string,
  userRole?: UserRole,
): Promise<
  JarvisQueryResponse | JarvisCommandResponse | JarvisPayoutProposalResponse | null
> {
  const classified = await classifyIntent(rawText);
  return routeClassifiedJarvisInput(classified, shopId, userId, timezone, userRole);
}
