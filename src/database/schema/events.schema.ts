import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const eventSourceEnum = pgEnum('event_source', ['webhook', 'reconciliation', 'backfill']);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    eventType: text('event_type').notNull(),
    eventTime: timestamp('event_time').notNull(),
    externalId: text('external_id'),
    dedupeKey: text('dedupe_key').notNull().unique(),
    source: eventSourceEnum('source').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantLocationTimeIdx: index('events_tenant_location_time_idx').on(
      table.tenantId,
      table.locationId,
      table.eventTime,
    ),
    dedupeKeyIdx: index('events_dedupe_key_idx').on(table.dedupeKey),
  }),
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
