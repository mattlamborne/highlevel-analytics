import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { metricRules } from '../database/schema';
import { and, eq } from 'drizzle-orm';

export interface CreateMetricRuleDto {
  tenantId: string;
  locationId: string;
  startDateFieldKey: string;
  departingDateFieldKey: string;
  mrrSource: 'opportunity_value' | 'custom_field';
  mrrCustomFieldKey?: string | null;
}

@Injectable()
export class MetricRulesRepository {
  private readonly logger = new Logger(MetricRulesRepository.name);

  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  /**
   * Upsert metric rules for a location
   */
  async upsert(dto: CreateMetricRuleDto): Promise<void> {
    await this.db
      .insert(metricRules)
      .values({
        tenantId: dto.tenantId,
        locationId: dto.locationId,
        startDateFieldKey: dto.startDateFieldKey,
        departingDateFieldKey: dto.departingDateFieldKey,
        mrrSource: dto.mrrSource,
        mrrCustomFieldKey: dto.mrrCustomFieldKey || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [metricRules.tenantId, metricRules.locationId],
        set: {
          startDateFieldKey: dto.startDateFieldKey,
          departingDateFieldKey: dto.departingDateFieldKey,
          mrrSource: dto.mrrSource,
          mrrCustomFieldKey: dto.mrrCustomFieldKey || null,
          updatedAt: new Date(),
        },
      });

    this.logger.log(`Metric rules upserted for location ${dto.locationId}`);
  }

  /**
   * Find metric rules by location
   */
  async findByLocation(tenantId: string, locationId: string) {
    const result = await this.db
      .select()
      .from(metricRules)
      .where(
        and(
          eq(metricRules.tenantId, tenantId),
          eq(metricRules.locationId, locationId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find all metric rules for a tenant
   */
  async findByTenant(tenantId: string) {
    return this.db
      .select()
      .from(metricRules)
      .where(eq(metricRules.tenantId, tenantId));
  }

  /**
   * Get or create default metric rules for a location
   */
  async getOrCreateDefault(tenantId: string, locationId: string) {
    let rules = await this.findByLocation(tenantId, locationId);

    if (!rules) {
      // Create default rules
      const defaultRules: CreateMetricRuleDto = {
        tenantId,
        locationId,
        startDateFieldKey: 'start_date',
        departingDateFieldKey: 'departing_date',
        mrrSource: 'opportunity_value',
        mrrCustomFieldKey: null,
      };

      await this.upsert(defaultRules);
      rules = await this.findByLocation(tenantId, locationId);
    }

    return rules!;
  }
}
