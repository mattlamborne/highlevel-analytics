import { pgTable, uuid, text, timestamp, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const contactsCache = pgTable(
  'contacts_cache',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    contactId: text('contact_id').notNull(),
    email: text('email'),
    phone: text('phone'),
    name: text('name'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    customFields: jsonb('custom_fields'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.locationId, table.contactId] }),
    tenantLocationCreatedIdx: index('contacts_cache_tenant_location_created_idx').on(
      table.tenantId,
      table.locationId,
      table.createdAt,
    ),
  }),
);

export type ContactCache = typeof contactsCache.$inferSelect;
export type NewContactCache = typeof contactsCache.$inferInsert;
