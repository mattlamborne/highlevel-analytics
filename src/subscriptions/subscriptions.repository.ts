import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { subscriptions } from '../database/schema';
import { and, eq } from 'drizzle-orm';

export interface UpsertSubscriptionDto {
  tenantId: string;
  locationId: string;
  contactId: string;
  startDate?: Date | null;
  departingDate?: Date | null;
  mrr?: number | null;
  status: 'scheduled' | 'active' | 'churned';
  firstWonAt?: Date | null;
  lastWonOpportunityId?: string | null;
}

@Injectable()
export class SubscriptionsRepository {
  private readonly logger = new Logger(SubscriptionsRepository.name);

  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  /**
   * Upsert a subscription (insert or update)
   */
  async upsert(dto: UpsertSubscriptionDto): Promise<void> {
    const values: any = {
      tenantId: dto.tenantId,
      locationId: dto.locationId,
      contactId: dto.contactId,
      startDate: dto.startDate ? dto.startDate.toISOString().split('T')[0] : null,
      departingDate: dto.departingDate ? dto.departingDate.toISOString().split('T')[0] : null,
      mrr: dto.mrr?.toString() || null,
      status: dto.status,
      firstWonAt: dto.firstWonAt || null,
      lastWonOpportunityId: dto.lastWonOpportunityId || null,
    };

    await this.db
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({
        target: [
          subscriptions.tenantId,
          subscriptions.locationId,
          subscriptions.contactId,
        ],
        set: {
          startDate: values.startDate,
          departingDate: values.departingDate,
          mrr: values.mrr,
          status: values.status,
          firstWonAt: values.firstWonAt,
          lastWonOpportunityId: values.lastWonOpportunityId,
        },
      });

    this.logger.debug(`Subscription upserted: ${dto.contactId} (${dto.status})`);
  }

  /**
   * Find a subscription by contact ID
   */
  async findByContactId(
    tenantId: string,
    locationId: string,
    contactId: string,
  ) {
    const result = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.locationId, locationId),
          eq(subscriptions.contactId, contactId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find all active subscriptions
   */
  async findActive(tenantId: string, locationId: string) {
    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.locationId, locationId),
          eq(subscriptions.status, 'active'),
        ),
      );
  }

  /**
   * Find subscriptions that churned within a date range
   */
  async findChurnedInRange(
    tenantId: string,
    locationId: string,
    from: Date,
    to: Date,
  ) {
    const result = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.locationId, locationId),
          eq(subscriptions.status, 'churned'),
        ),
      );

    // Filter by departing date range
    return result.filter((sub) => {
      if (!sub.departingDate) return false;
      const departingDate = new Date(sub.departingDate);
      return departingDate >= from && departingDate <= to;
    });
  }
}
