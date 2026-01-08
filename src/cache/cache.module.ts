import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ContactsCacheRepository } from './contacts-cache.repository';
import { OpportunitiesCacheRepository } from './opportunities-cache.repository';
import { AppointmentsCacheRepository } from './appointments-cache.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    ContactsCacheRepository,
    OpportunitiesCacheRepository,
    AppointmentsCacheRepository,
  ],
  exports: [
    ContactsCacheRepository,
    OpportunitiesCacheRepository,
    AppointmentsCacheRepository,
  ],
})
export class CacheModule {}
