import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const oauthStates = pgTable('oauth_states', {
  state: text('state').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;
