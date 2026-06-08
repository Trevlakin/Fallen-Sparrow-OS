/**
 * Keep facility/mechanical issues in incidents only; drop redundant repair-scheduling tasks.
 */

export interface DedupableBrainDump {
  expenses: unknown[];
  incidents: Array<{ description: string }>;
  tasks: Array<{ description: string }>;
  strategicNotes: unknown[];
  suggestions: unknown[];
}

const FACILITY_TOKENS = [
  "ac",
  "hvac",
  "air condition",
  "air conditioning",
  "cooling",
  "heat",
  "furnace",
  "drain",
  "sink",
  "plumb",
  "plumber",
  "toilet",
  "water leak",
  "leak",
  "autoclave",
  "steril",
  "equipment",
  "breaker",
  "electrical",
  "outlet",
  "compressor",
  "thermostat",
  "unit cycling",
  "cycling on and off",
];

const SCHEDULE_REPAIR_PATTERN =
  /\b(schedule|call|book|hire|get|dispatch|arrange)\b.*\b(service|repair|plumber|technician|maintenance|hvac|ac)\b/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function significantWords(text: string): Set<string> {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "about",
    "need",
    "needs",
    "needed",
    "call",
    "schedule",
    "likely",
    "before",
    "after",
    "today",
    "yesterday",
    "shop",
    "back",
  ]);
  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w.length > 3 && !stop.has(w)),
  );
}

function sharedFacilityToken(taskText: string, incidentText: string): boolean {
  const t = normalize(taskText);
  const i = normalize(incidentText);
  return FACILITY_TOKENS.some((token) => t.includes(token) && i.includes(token));
}

function wordOverlapCount(a: string, b: string): number {
  const wordsA = significantWords(a);
  let count = 0;
  for (const w of significantWords(b)) {
    if (wordsA.has(w)) count++;
  }
  return count;
}

export function taskDuplicatesIncident(
  taskDescription: string,
  incidentDescription: string,
): boolean {
  if (sharedFacilityToken(taskDescription, incidentDescription)) {
    return true;
  }

  const overlap = wordOverlapCount(taskDescription, incidentDescription);
  if (overlap >= 3) {
    return true;
  }

  if (
    overlap >= 2 &&
    (SCHEDULE_REPAIR_PATTERN.test(taskDescription) ||
      /\b(service call|maintenance|plumber|repair)\b/i.test(taskDescription))
  ) {
    return true;
  }

  return false;
}

export function dedupeBrainDumpOutput<T extends DedupableBrainDump>(parsed: T): T {
  const incidents = parsed.incidents;
  const tasks = parsed.tasks.filter((task) => {
    return !incidents.some((inc) =>
      taskDuplicatesIncident(task.description, inc.description),
    );
  });

  return {
    ...parsed,
    tasks,
  };
}

export function dedupeTaskDescriptions(
  tasks: Array<{ id: string; description: string | null; title: string }>,
  incidents: Array<{ description: string }>,
): string[] {
  const toDelete: string[] = [];
  for (const task of tasks) {
    const desc = task.description ?? task.title;
    if (
      incidents.some((inc) => taskDuplicatesIncident(desc, inc.description))
    ) {
      toDelete.push(task.id);
    }
  }
  return toDelete;
}
