import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { JobsModule } from '../jobs/jobs.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SignatureVerifierService } from './signature-verifier.service';

@Module({
  imports: [EventsModule, JobsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, SignatureVerifierService],
})
export class WebhooksModule {}
