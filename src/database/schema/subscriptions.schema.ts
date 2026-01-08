import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  timestamp,
  pgEnum,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'scheduled',
  'active',
  'churned',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    contactId: text('contact_id').notNull(),
    startDate: date('start_date'),
    departingDate: date('departing_date'),
    mrr: numeric('mrr', { precision: 12, scale: 2 }),
    status: subscriptionStatusEnum('status').notNull().default('scheduled'),
    firstWonAt: timestamp('first_won_at'),
    lastWonOpportunityId: text('last_won_opportunity_id'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.locationId, table.contactId] }),
    tenantLocationStatusIdx: index('subscriptions_tenant_location_status_idx').on(
      table.tenantId,
      table.locationId,
      table.status,
    ),
    departingDateIdx: index('subscriptions_departing_date_idx').on(table.departingDate),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
