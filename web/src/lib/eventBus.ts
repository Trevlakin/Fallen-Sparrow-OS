const bus = new EventTarget();

export const DATA_EVENTS = {
  appointments: "data:appointments",
  expenses: "data:expenses",
  inventory: "data:inventory",
  tasks: "data:tasks",
  incidents: "data:incidents",
  sops: "data:sops",
  nudges: "data:nudges",
  followups: "data:followups",
} as const;

export type DataEvent = (typeof DATA_EVENTS)[keyof typeof DATA_EVENTS];

export function emitData(event: DataEvent): void {
  bus.dispatchEvent(new Event(event));
}

export function onData(event: DataEvent, fn: () => void): () => void {
  bus.addEventListener(event, fn);
  return () => bus.removeEventListener(event, fn);
}

export function emitJarvisCommitted(committed: {
  expenses?: number;
  incidents?: number;
  tasks?: number;
  strategicNotes?: number;
  notes?: number;
  inventoryUpdates?: number;
}): void {
  if ((committed.expenses ?? 0) > 0) emitData(DATA_EVENTS.expenses);
  if ((committed.tasks ?? 0) > 0) emitData(DATA_EVENTS.tasks);
  if ((committed.incidents ?? 0) > 0) emitData(DATA_EVENTS.incidents);
  if ((committed.inventoryUpdates ?? 0) > 0) emitData(DATA_EVENTS.inventory);
  const notes = committed.notes ?? committed.strategicNotes ?? 0;
  if (notes > 0) {
    emitData(DATA_EVENTS.expenses);
  }
}

export function emitCsvImport(format: "expenses" | "appointments" | "porter"): void {
  if (format === "expenses") {
    emitData(DATA_EVENTS.expenses);
  } else if (format === "appointments" || format === "porter") {
    emitData(DATA_EVENTS.appointments);
    emitData(DATA_EVENTS.expenses);
    emitData(DATA_EVENTS.followups);
  }
}
