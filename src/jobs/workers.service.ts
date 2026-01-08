import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PGBOSS_TOKEN, PgBossInstance } from './pgboss.provider';
import { WebhookProcessor } from './processors/webhook.processor';

@Injectable()
export class WorkersService implements OnModuleInit {
  private readonly logger = new Logger(WorkersService.name);

  constructor(
    @Inject(PGBOSS_TOKEN) private readonly boss: PgBossInstance,
    private readonly webhookProcessor: WebhookProcessor,
  ) {}

  /**
   * Register all workers when the module initializes
   */
  async onModuleInit() {
    await this.registerWorkers();
  }

  /**
   * Register all pg-boss workers
   */
  private async registerWorkers() {
    this.logger.log('Registering pg-boss workers...');

    // Register webhook processor
    await this.boss.work(
      'process-webhook',
      {
        teamSize: 5, // Process up to 5 jobs concurrently
        teamConcurrency: 1, // Each worker handles 1 job at a time
      },
      async (job: any) => {
        await this.webhookProcessor.process(job.data);
      },
    );

    this.logger.log('Webhook processor registered (teamSize: 5)');

    // Future workers will be registered here:
    // - reconciliation worker
    // - scheduled jobs
    // - etc.

    this.logger.log('All workers registered successfully');
  }
}
