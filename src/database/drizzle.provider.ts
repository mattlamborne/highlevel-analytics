import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Dynamic import to avoid webpack issues
const getPostgresClient = async () => {
  const postgres = await import('postgres');
  // Handle both ESM and CJS module formats
  return postgres.default || postgres;
};

export const DRIZZLE_TOKEN = 'DRIZZLE_DB';

export const drizzleProvider = {
  provide: DRIZZLE_TOKEN,
  useFactory: async () => {
    const connectionString = process.env.DATABASE_URL!;
    const postgresConstructor = await getPostgresClient();
    const client = postgresConstructor(connectionString);
    return drizzle(client, { schema });
  },
};

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;
