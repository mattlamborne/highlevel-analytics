import { pgTable, uuid, text, timestamp, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const appointmentsCache = pgTable(
  'appointments_cache',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    appointmentId: text('appointment_id').notNull(),
    contactId: text('contact_id'),
    calendarId: text('calendar_id'),
    startTime: timestamp('start_time').notNull(),
    status: text('status'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    raw: jsonb('raw'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.locationId, table.appointmentId] }),
    tenantLocationCreatedIdx: index('appointments_cache_tenant_location_created_idx').on(
      table.tenantId,
      table.locationId,
      table.createdAt,
    ),
  }),
);

export type AppointmentCache = typeof appointmentsCache.$inferSelect;
export type NewAppointmentCache = typeof appointmentsCache.$inferInsert;
