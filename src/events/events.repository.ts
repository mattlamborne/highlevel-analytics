import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { events } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface CreateEventDto {
  tenantId: string;
  locationId: string;
  eventType: string;
  eventTime: Date;
  externalId?: string;
  source: 'webhook' | 'reconciliation' | 'backfill';
  payload: any;
}

@Injectable()
export class EventsRepository {
  private readonly logger = new Logger(EventsRepository.name);

  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  /**
   * Insert an event with deduplication
   * Returns true if event was inserted, false if already exists
   */
  async createEvent(dto: CreateEventDto): Promise<{ inserted: boolean; eventId: string }> {
    // Generate dedupe key from event properties
    const dedupeKey = this.generateDedupeKey(
      dto.eventType,
      dto.externalId || '',
      dto.eventTime,
    );

    try {
      const result = await this.db
        .insert(events)
        .values({
          tenantId: dto.tenantId,
          locationId: dto.locationId,
          eventType: dto.eventType,
          eventTime: dto.eventTime,
          externalId: dto.externalId || null,
          dedupeKey,
          source: dto.source,
          payload: dto.payload,
        })
        .returning({ id: events.id });

      this.logger.debug(`Event created: ${result[0].id} (${dto.eventType})`);
      return { inserted: true, eventId: result[0].id };
    } catch (error: any) {
      // Check if it's a unique constraint violation on dedupeKey
      if (error.code === '23505' && error.constraint === 'events_dedupe_key_unique') {
        this.logger.debug(`Event already exists: ${dedupeKey}`);
        // Fetch the existing event ID
        const existing = await this.db
          .select({ id: events.id })
          .from(events)
          .where(eq(events.dedupeKey, dedupeKey))
          .limit(1);

        return { inserted: false, eventId: existing[0]?.id || '' };
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Generate a unique dedupe key for an event
   * Format: {eventType}:{externalId}:{timestamp}
   */
  private generateDedupeKey(
    eventType: string,
    externalId: string,
    eventTime: Date,
  ): string {
    const timestamp = eventTime.toISOString();
    return `${eventType}:${externalId}:${timestamp}`;
  }

  /**
   * Find an event by ID
   */
  async findById(eventId: string) {
    const result = await this.db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find events by tenant and location within a time range
   */
  async findByTimeRange(
    tenantId: string,
    locationId: string,
    from: Date,
    to: Date,
  ) {
    const result = await this.db
      .select()
      .from(events)
      .where(
        eq(events.tenantId, tenantId),
      );

    // Filter in memory for now (can optimize with SQL later)
    return result.filter(
      (e) =>
        e.locationId === locationId &&
        e.eventTime >= from &&
        e.eventTime <= to,
    );
  }
}
