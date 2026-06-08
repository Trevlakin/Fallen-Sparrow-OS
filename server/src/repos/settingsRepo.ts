import { eq } from "drizzle-orm";
import { settings } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return row.value as T;
}

export async function upsertSetting(key: string, value: unknown): Promise<void> {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  if (existing[0]) {
    await db
      .update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
}
