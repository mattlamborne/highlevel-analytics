import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MetricRulesRepository } from './metric-rules.repository';
import { MetricRulesController } from './metric-rules.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [MetricRulesController],
  providers: [MetricRulesRepository],
  exports: [MetricRulesRepository],
})
export class MetricRulesModule {}
