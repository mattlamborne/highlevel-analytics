import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrations = async () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/highlevel_analytics';

  console.log('Running migrations...');
  console.log('Database URL:', connectionString.replace(/:[^:@]+@/, ':****@'));

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  await migrate(db, { migrationsFolder: './src/database/migrations' });

  await migrationClient.end();

  console.log('Migrations completed successfully!');
};

runMigrations().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
