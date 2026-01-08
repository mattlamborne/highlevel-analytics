import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionCalculatorService } from './subscription-calculator.service';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [DatabaseModule, CacheModule],
  providers: [
    SubscriptionsRepository,
    SubscriptionCalculatorService,
    SubscriptionsService,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionsRepository,
    SubscriptionCalculatorService,
  ],
})
export class SubscriptionsModule {}
