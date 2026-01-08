import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const opportunitiesCache = pgTable(
  'opportunities_cache',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    opportunityId: text('opportunity_id').notNull(),
    contactId: text('contact_id'),
    pipelineId: text('pipeline_id'),
    stageId: text('stage_id'),
    status: text('status').notNull(),
    value: numeric('value', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    wonAt: timestamp('won_at'),
    raw: jsonb('raw'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.locationId, table.opportunityId] }),
    tenantLocationStatusWonIdx: index('opportunities_cache_tenant_location_status_won_idx').on(
      table.tenantId,
      table.locationId,
      table.status,
      table.wonAt,
    ),
    contactIdIdx: index('opportunities_cache_contact_id_idx').on(table.contactId),
  }),
);

export type OpportunityCache = typeof opportunitiesCache.$inferSelect;
export type NewOpportunityCache = typeof opportunitiesCache.$inferInsert;
