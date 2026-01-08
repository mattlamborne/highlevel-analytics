import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { opportunitiesCache } from '../database/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

export interface UpsertOpportunityDto {
  tenantId: string;
  locationId: string;
  opportunityId: string;
  contactId?: string;
  pipelineId?: string;
  stageId?: string;
  status: string;
  value?: number;
  createdAt: Date;
  updatedAt: Date;
  wonAt?: Date | null;
  raw?: Record<string, any>;
}

@Injectable()
export class OpportunitiesCacheRepository {
  private readonly logger = new Logger(OpportunitiesCacheRepository.name);

  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  /**
   * Upsert an opportunity (insert or update)
   */
  async upsert(dto: UpsertOpportunityDto): Promise<void> {
    await this.db
      .insert(opportunitiesCache)
      .values({
        tenantId: dto.tenantId,
        locationId: dto.locationId,
        opportunityId: dto.opportunityId,
        contactId: dto.contactId || null,
        pipelineId: dto.pipelineId || null,
        stageId: dto.stageId || null,
        status: dto.status,
        value: dto.value?.toString() || null,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        wonAt: dto.wonAt || null,
        raw: dto.raw || null,
      })
      .onConflictDoUpdate({
        target: [
          opportunitiesCache.tenantId,
          opportunitiesCache.locationId,
          opportunitiesCache.opportunityId,
        ],
        set: {
          contactId: dto.contactId || null,
          pipelineId: dto.pipelineId || null,
          stageId: dto.stageId || null,
          status: dto.status,
          value: dto.value?.toString() || null,
          updatedAt: dto.updatedAt,
          wonAt: dto.wonAt || null,
          raw: dto.raw || null,
        },
      });

    this.logger.debug(`Opportunity upserted: ${dto.opportunityId}`);
  }

  /**
   * Find an opportunity by ID
   */
  async findById(
    tenantId: string,
    locationId: string,
    opportunityId: string,
  ) {
    const result = await this.db
      .select()
      .from(opportunitiesCache)
      .where(
        and(
          eq(opportunitiesCache.tenantId, tenantId),
          eq(opportunitiesCache.locationId, locationId),
          eq(opportunitiesCache.opportunityId, opportunityId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find won opportunities within a date range
   */
  async findWonInRange(
    tenantId: string,
    locationId: string,
    from: Date,
    to: Date,
  ) {
    const result = await this.db
      .select()
      .from(opportunitiesCache)
      .where(
        and(
          eq(opportunitiesCache.tenantId, tenantId),
          eq(opportunitiesCache.locationId, locationId),
          eq(opportunitiesCache.status, 'won'),
          isNotNull(opportunitiesCache.wonAt),
        ),
      );

    // Filter by date range in memory (can optimize with SQL later)
    return result.filter((opp) => {
      if (!opp.wonAt) return false;
      return opp.wonAt >= from && opp.wonAt <= to;
    });
  }
}
