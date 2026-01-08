import { pgTable, uuid, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const mrrSourceEnum = pgEnum('mrr_source', ['opportunity_value', 'custom_field']);

export const metricRules = pgTable(
  'metric_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    startDateFieldKey: text('start_date_field_key').notNull(),
    departingDateFieldKey: text('departing_date_field_key').notNull(),
    mrrSource: mrrSourceEnum('mrr_source').notNull().default('opportunity_value'),
    mrrCustomFieldKey: text('mrr_custom_field_key'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantLocationUnique: unique('metric_rules_tenant_location_unique').on(
      table.tenantId,
      table.locationId,
    ),
  }),
);

export type MetricRule = typeof metricRules.$inferSelect;
export type NewMetricRule = typeof metricRules.$inferInsert;
