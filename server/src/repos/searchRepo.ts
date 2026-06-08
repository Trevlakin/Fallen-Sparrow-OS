import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  appointmentPayments,
  appointments,
  artists,
  customers,
  expenses,
} from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal } from "../lib/profit.js";

export const SEARCH_PER_CATEGORY_LIMIT = 10;

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

export interface AppointmentSearchRow {
  id: string;
  serviceType: string;
  artistName: string | null;
  customerName: string | null;
  totalRevenue: number;
  appointmentDate: Date;
}

export async function searchAppointments(
  query: string,
  limit = SEARCH_PER_CATEGORY_LIMIT,
): Promise<AppointmentSearchRow[]> {
  const pattern = likePattern(query);
  const rows = await db
    .select({
      id: appointments.id,
      serviceType: appointments.serviceType,
      artistName: artists.name,
      customerName: customers.name,
      totalRevenue: appointmentPayments.totalRevenue,
      appointmentDate: appointments.appointmentDate,
    })
    .from(appointments)
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(artists, eq(artists.id, appointments.artistId))
    .leftJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    )
    .where(
      or(
        ilike(sql`${appointments.serviceType}::text`, pattern),
        ilike(customers.name, pattern),
        ilike(artists.name, pattern),
        ilike(appointments.notes, pattern),
      ),
    )
    .orderBy(desc(appointments.appointmentDate))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    serviceType: row.serviceType,
    artistName: row.artistName,
    customerName: row.customerName,
    totalRevenue: parseDecimal(row.totalRevenue),
    appointmentDate: row.appointmentDate,
  }));
}

export interface ExpenseSearchRow {
  id: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: Date;
}

export async function searchExpenses(
  query: string,
  limit = SEARCH_PER_CATEGORY_LIMIT,
): Promise<ExpenseSearchRow[]> {
  const pattern = likePattern(query);
  const rows = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      category: expenses.category,
      expenseDate: expenses.expenseDate,
    })
    .from(expenses)
    .where(
      or(ilike(expenses.description, pattern), ilike(expenses.category, pattern)),
    )
    .orderBy(desc(expenses.expenseDate))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: parseDecimal(row.amount),
    category: row.category,
    expenseDate: row.expenseDate,
  }));
}

export interface CustomerSearchRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export async function searchCustomers(
  query: string,
  limit = SEARCH_PER_CATEGORY_LIMIT,
): Promise<CustomerSearchRow[]> {
  const pattern = likePattern(query);
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(
      or(
        ilike(customers.name, pattern),
        ilike(customers.email, pattern),
        ilike(customers.phone, pattern),
      ),
    )
    .orderBy(desc(customers.lastAppointmentDate))
    .limit(limit);

  return rows;
}

export interface ArtistSearchRow {
  id: string;
  name: string;
}

export async function searchArtists(
  query: string,
  limit = SEARCH_PER_CATEGORY_LIMIT,
): Promise<ArtistSearchRow[]> {
  const pattern = likePattern(query);
  const rows = await db
    .select({
      id: artists.id,
      name: artists.name,
    })
    .from(artists)
    .where(and(eq(artists.isActive, true), ilike(artists.name, pattern)))
    .orderBy(artists.name)
    .limit(limit);

  return rows;
}
