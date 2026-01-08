import { Logger } from '@nestjs/common';

export const PGBOSS_TOKEN = 'PGBOSS_INSTANCE';

// Dynamic import to avoid webpack issues
const getPgBoss = async () => {
  const pgBossModule = await import('pg-boss');
  // Handle both ESM and CJS module formats
  return pgBossModule.default || pgBossModule;
};

export const pgBossProvider = {
  provide: PGBOSS_TOKEN,
  useFactory: async (): Promise<any> => {
    const logger = new Logger('PgBoss');
    const connectionString = process.env.DATABASE_URL!;

    const PgBoss = await getPgBoss();
    const boss = new PgBoss({
      connectionString,
      // Schema for pg-boss tables (keeps them separate from app tables)
      schema: 'pgboss',
      // Retention settings
      retentionDays: 7, // Keep completed jobs for 7 days
      retentionHours: 24, // Archive jobs after 24 hours
      // Monitoring and maintenance
      monitorStateIntervalSeconds: 60,
      maintenanceIntervalSeconds: 300,
      // Worker settings
      newJobCheckInterval: 2000, // Check for new jobs every 2 seconds
      newJobCheckIntervalSeconds: 2,
      // Error handling
      onComplete: true, // Enable completion events
      // Logging
      noSupervisor: false,
      noScheduling: false,
    });

    boss.on('error', (error) => {
      logger.error('pg-boss error:', error);
    });

    boss.on('monitor-states', (states) => {
      logger.debug(`Job states: ${JSON.stringify(states)}`);
    });

    // Start pg-boss (will create tables if they don't exist)
    await boss.start();
    logger.log('pg-boss started successfully');

    return boss;
  },
};

export type PgBossInstance = any; // Using any due to dynamic import
