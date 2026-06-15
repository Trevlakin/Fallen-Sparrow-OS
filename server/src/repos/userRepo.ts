import { eq } from "drizzle-orm";
import { users, type NewUser, type User } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0];
}

export async function findUserById(id: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function createUser(data: NewUser): Promise<User> {
  const rows = await db.insert(users).values(data).returning();
  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create user");
  }
  return created;
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserEmail(
  userId: string,
  email: string,
): Promise<void> {
  await db
    .update(users)
    .set({ email: email.toLowerCase() })
    .where(eq(users.id, userId));
}
