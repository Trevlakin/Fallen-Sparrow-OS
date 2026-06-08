import { getApiBase } from "./apiBase.js";

const API_BASE = getApiBase();

export class ChecklistApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ChecklistApiError";
  }
}

/** In-memory session token (not persisted). */
let memorySessionToken: string | null = null;

export function getChecklistSessionToken(): string | null {
  return memorySessionToken;
}

export function setChecklistSessionToken(token: string | null): void {
  memorySessionToken = token;
}

async function checklistRequest<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = sessionToken ?? getChecklistSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ChecklistApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export interface ChecklistEmployee {
  id: string;
  displayName: string;
  role: string;
}

export interface TodayChecklistSop {
  id: string;
  title: string;
  items: {
    id: string;
    text: string;
    sortOrder: number;
    completed: boolean;
    completedAt: string | null;
  }[];
  completedCount: number;
  totalCount: number;
}

export type ExtraTaskStatus = "open" | "in_progress" | "done";

export interface ExtraTask {
  id: string;
  description: string;
  status: ExtraTaskStatus;
  loggedAt: string;
  completedAt: string | null;
  loggedByLabel: string | null;
}

export const checklistApi = {
  listEmployees: () =>
    checklistRequest<{ employees: ChecklistEmployee[] }>("/api/checklist/employees"),

  login: (teamMemberId: string, pin: string) =>
    checklistRequest<{
      sessionToken: string;
      teamMember: { id: string; displayName: string; role: string };
    }>("/api/checklist/login", {
      method: "POST",
      body: JSON.stringify({ teamMemberId, pin }),
    }),

  getToday: (sessionDate?: string) =>
    checklistRequest<{
      teamMember: { id: string; displayName: string; role: string };
      sops: TodayChecklistSop[];
      overallProgress: { completed: number; total: number };
    }>(
      `/api/checklist/today${sessionDate ? `?sessionDate=${sessionDate}` : ""}`,
    ),

  complete: (itemId: string) =>
    checklistRequest<void>(`/api/checklist/complete/${itemId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  uncomplete: (itemId: string) =>
    checklistRequest<void>(`/api/checklist/complete/${itemId}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    }),

  listExtraTasksToday: (sessionDate?: string) =>
    checklistRequest<ExtraTask[]>(
      `/api/extra-tasks/today${sessionDate ? `?sessionDate=${sessionDate}` : ""}`,
    ),

  addExtraTask: (description: string, loggedByLabel: string, sessionDate?: string) =>
    checklistRequest<ExtraTask>("/api/extra-tasks", {
      method: "POST",
      body: JSON.stringify({ description, loggedByLabel, sessionDate }),
    }),

  updateExtraTaskStatus: (taskId: string, status: ExtraTaskStatus) =>
    checklistRequest<ExtraTask>(`/api/extra-tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function formatChecklistTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatExtraTaskDuration(
  loggedAt: string,
  completedAt: string | null,
): string {
  if (!completedAt) return "";
  const minutes = Math.round(
    (new Date(completedAt).getTime() - new Date(loggedAt).getTime()) / 60_000,
  );
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function checklistBorderClass(
  pct: number,
  completedToday: number,
): "complete" | "progress" | "late" {
  if (pct === 100) return "complete";
  const hour = new Date().getHours();
  if (completedToday === 0 && hour >= 2) return "late";
  return "progress";
}

export function greetingForHour(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
