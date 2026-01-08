import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MetricRulesRepository, CreateMetricRuleDto } from './metric-rules.repository';

@Controller('metric-rules')
export class MetricRulesController {
  private readonly logger = new Logger(MetricRulesController.name);

  constructor(private readonly metricRulesRepo: MetricRulesRepository) {}

  /**
   * Get metric rules for a location
   * GET /metric-rules/:tenantId/:locationId
   */
  @Get(':tenantId/:locationId')
  async getMetricRules(
    @Param('tenantId') tenantId: string,
    @Param('locationId') locationId: string,
  ) {
    if (!tenantId || !locationId) {
      throw new BadRequestException('tenantId and locationId are required');
    }

    const rules = await this.metricRulesRepo.getOrCreateDefault(tenantId, locationId);

    return rules;
  }

  /**
   * Update metric rules for a location
   * PUT /metric-rules/:tenantId/:locationId
   * Body: {
   *   startDateFieldKey: "start_date",
   *   departingDateFieldKey: "departing_date",
   *   mrrSource: "opportunity_value" | "custom_field",
   *   mrrCustomFieldKey?: "monthly_value"
   * }
   */
  @Put(':tenantId/:locationId')
  async updateMetricRules(
    @Param('tenantId') tenantId: string,
    @Param('locationId') locationId: string,
    @Body() body: Partial<CreateMetricRuleDto>,
  ) {
    if (!tenantId || !locationId) {
      throw new BadRequestException('tenantId and locationId are required');
    }

    // Validate required fields
    if (!body.startDateFieldKey || !body.departingDateFieldKey) {
      throw new BadRequestException(
        'startDateFieldKey and departingDateFieldKey are required',
      );
    }

    // Validate MRR source
    if (
      body.mrrSource &&
      !['opportunity_value', 'custom_field'].includes(body.mrrSource)
    ) {
      throw new BadRequestException(
        'mrrSource must be either "opportunity_value" or "custom_field"',
      );
    }

    // If MRR source is custom_field, validate that mrrCustomFieldKey is provided
    if (body.mrrSource === 'custom_field' && !body.mrrCustomFieldKey) {
      throw new BadRequestException(
        'mrrCustomFieldKey is required when mrrSource is "custom_field"',
      );
    }

    const dto: CreateMetricRuleDto = {
      tenantId,
      locationId,
      startDateFieldKey: body.startDateFieldKey,
      departingDateFieldKey: body.departingDateFieldKey,
      mrrSource: body.mrrSource || 'opportunity_value',
      mrrCustomFieldKey: body.mrrCustomFieldKey || null,
    };

    await this.metricRulesRepo.upsert(dto);

    this.logger.log(`Metric rules updated for location ${locationId}`);

    return {
      message: 'Metric rules updated successfully',
      rules: await this.metricRulesRepo.findByLocation(tenantId, locationId),
    };
  }
}
