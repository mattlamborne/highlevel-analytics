import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/highlevel_analytics',
  },
  verbose: true,
  strict: true,
} satisfies Config;
