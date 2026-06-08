import { eq } from "drizzle-orm";
import {
  appointmentPayments,
  appointments,
} from "@fallen-sparrow/shared/schema";
import type { SchemaServiceType } from "@fallen-sparrow/shared/serviceTypes";
import { db } from "../config/database.js";

export async function upsertPaymentForAppointment(
  appointmentId: string,
  data: typeof appointmentPayments.$inferInsert,
): Promise<void> {
  const existing = await db
    .select()
    .from(appointmentPayments)
    .where(eq(appointmentPayments.appointmentId, appointmentId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(appointmentPayments)
      .set(data)
      .where(eq(appointmentPayments.appointmentId, appointmentId));
  } else {
    await db.insert(appointmentPayments).values(data);
  }
}

export async function updatePaymentServiceTypeForAppointment(
  appointmentId: string,
  serviceType: SchemaServiceType,
): Promise<void> {
  await db
    .update(appointmentPayments)
    .set({ serviceType })
    .where(eq(appointmentPayments.appointmentId, appointmentId));
}

export async function listCompletedAppointmentsByCustomer(
  customerId: string,
): Promise<
  Array<{
    appointmentDate: Date;
    totalRevenue: string | null;
  }>
> {
  return db
    .select({
      appointmentDate: appointments.appointmentDate,
      totalRevenue: appointmentPayments.totalRevenue,
    })
    .from(appointments)
    .leftJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    )
    .where(eq(appointments.customerId, customerId));
}
