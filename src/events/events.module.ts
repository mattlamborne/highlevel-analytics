import { Module } from '@nestjs/common';
import { EventsRepository } from './events.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [EventsRepository],
  exports: [EventsRepository],
})
export class EventsModule {}
