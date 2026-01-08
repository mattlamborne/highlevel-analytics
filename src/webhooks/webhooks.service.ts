import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { EventsRepository } from '../events/events.repository';
import { PGBOSS_TOKEN, PgBossInstance } from '../jobs/pgboss.provider';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { ghlInstallations } from '../database/schema';

interface WebhookPayload {
  type: string;
  locationId?: string;
  companyId?: string;
  [key: string]: any;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly eventsRepo: EventsRepository,
    @Inject(PGBOSS_TOKEN) private readonly boss: PgBossInstance,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  /**
   * Process incoming webhook
   * 1. Look up tenant from locationId
   * 2. Store event in events table (with deduplication)
   * 3. Enqueue processing job
   */
  async processWebhook(
    locationId: string,
    payload: WebhookPayload,
  ): Promise<{ eventId: string; queued: boolean }> {
    this.logger.debug(`Processing webhook: ${payload.type} for location ${locationId}`);

    // Look up installation to get tenantId
    const [installation] = await this.db
      .select()
      .from(ghlInstallations)
      .where(eq(ghlInstallations.locationId, locationId))
      .limit(1);

    if (!installation) {
      this.logger.error(`No installation found for locationId: ${locationId}`);
      throw new NotFoundException(`Installation not found for location ${locationId}`);
    }

    const tenantId = installation.tenantId;
    this.logger.debug(`Found tenant ${tenantId} for location ${locationId}`);

    // Extract event details
    const eventType = payload.type;
    const externalId = this.extractExternalId(payload);
    const eventTime = this.extractEventTime(payload);

    // Store event in database (idempotent)
    const { inserted, eventId } = await this.eventsRepo.createEvent({
      tenantId,
      locationId,
      eventType,
      eventTime,
      externalId,
      source: 'webhook',
      payload,
    });

    if (!inserted) {
      this.logger.debug(`Event already exists: ${eventId}. Skipping job queue.`);
      return { eventId, queued: false };
    }

    // Enqueue processing job using pg-boss
    await this.boss.send('process-webhook', {
      eventId,
      tenantId,
      locationId,
      eventType,
    });

    this.logger.log(`Webhook queued for processing: ${eventId} (${eventType})`);
    return { eventId, queued: true };
  }

  /**
   * Extract external ID from webhook payload
   * (e.g., contact ID, opportunity ID, appointment ID)
   */
  private extractExternalId(payload: WebhookPayload): string {
    // Common ID fields in HighLevel webhooks
    return (
      payload.id ||
      payload.contactId ||
      payload.opportunityId ||
      payload.appointmentId ||
      payload.eventId ||
      ''
    );
  }

  /**
   * Extract event timestamp from payload
   * Falls back to current time if not provided
   */
  private extractEventTime(payload: WebhookPayload): Date {
    const timestamp =
      payload.timestamp ||
      payload.updatedAt ||
      payload.createdAt ||
      payload.eventTime;

    if (timestamp) {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }
}
