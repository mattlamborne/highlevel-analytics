import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.schema';

export const installationStatusEnum = pgEnum('installation_status', [
  'active',
  'revoked',
  'error',
]);

export const ghlInstallations = pgTable(
  'ghl_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: text('company_id').notNull(),
    locationId: text('location_id').notNull().unique(),
    accessTokenEnc: text('access_token_enc').notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    scopes: text('scopes').notNull(),
    status: installationStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('ghl_installations_tenant_id_idx').on(table.tenantId),
  }),
);

export type GhlInstallation = typeof ghlInstallations.$inferSelect;
export type NewGhlInstallation = typeof ghlInstallations.$inferInsert;
