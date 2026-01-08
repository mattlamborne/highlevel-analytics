import { Module, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { pgBossProvider, PGBOSS_TOKEN, PgBossInstance } from './pgboss.provider';
import { WorkersService } from './workers.service';
import { WebhookProcessor } from './processors/webhook.processor';
import { EventsModule } from '../events/events.module';
import { CacheModule } from '../cache/cache.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MetricRulesModule } from '../metric-rules/metric-rules.module';
import { GhlClientModule } from '../ghl-client/ghl-client.module';

@Module({
  imports: [
    EventsModule,
    CacheModule,
    SubscriptionsModule,
    MetricRulesModule,
    GhlClientModule,
  ],
  providers: [pgBossProvider, WorkersService, WebhookProcessor],
  exports: [PGBOSS_TOKEN],
})
export class JobsModule implements OnModuleDestroy {
  constructor(
    @Inject(PGBOSS_TOKEN) private readonly boss: PgBossInstance,
  ) {}

  async onModuleDestroy() {
    // Gracefully shut down pg-boss when the app stops
    await this.boss.stop();
  }
}
