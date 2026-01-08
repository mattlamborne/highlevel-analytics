import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Get all metrics for a time period
   * GET /metrics?tenant_id=xxx&location_id=xxx&from=2025-01-01&to=2025-12-31
   */
  @Get()
  async getMetrics(
    @Query('tenant_id') tenantId?: string,
    @Query('location_id') locationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Validate required parameters
    if (!tenantId || !locationId) {
      throw new BadRequestException(
        'tenant_id and location_id query parameters are required',
      );
    }

    // Parse and validate dates
    let fromDate: Date;
    let toDate: Date;

    try {
      fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
      toDate = to ? new Date(to) : new Date();

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException(
        'Invalid date format. Use ISO format (YYYY-MM-DD)',
      );
    }

    this.logger.debug(
      `Fetching metrics for tenant ${tenantId}, location ${locationId}, from ${fromDate.toISOString()} to ${toDate.toISOString()}`,
    );

    const metrics = await this.metricsService.getMetrics({
      tenantId,
      locationId,
      from: fromDate,
      to: toDate,
    });

    return {
      tenant_id: tenantId,
      location_id: locationId,
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      metrics,
    };
  }

  /**
   * Get a specific metric
   * GET /metrics/:metric?tenant_id=xxx&location_id=xxx&from=2025-01-01&to=2025-12-31
   */
  @Get(':metric')
  async getSpecificMetric(
    @Query('metric') metric: string,
    @Query('tenant_id') tenantId?: string,
    @Query('location_id') locationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Validate required parameters
    if (!tenantId || !locationId) {
      throw new BadRequestException(
        'tenant_id and location_id query parameters are required',
      );
    }

    // Parse dates
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();

    const query = {
      tenantId,
      locationId,
      from: fromDate,
      to: toDate,
    };

    let value: number;

    // Route to appropriate metric method
    switch (metric) {
      case 'leads':
        value = await this.metricsService.getLeadsCount(query);
        break;
      case 'bookings':
        value = await this.metricsService.getBookingsCount(query);
        break;
      case 'sales':
        value = await this.metricsService.getSalesCount(query);
        break;
      case 'churn':
        value = await this.metricsService.getChurnCount(query);
        break;
      case 'active_subscribers':
        value = await this.metricsService.getActiveSubscribersCount(query);
        break;
      case 'avg_ltv':
        value = await this.metricsService.getAverageLTV(query);
        break;
      default:
        throw new BadRequestException(
          `Unknown metric: ${metric}. Valid metrics: leads, bookings, sales, churn, active_subscribers, avg_ltv`,
        );
    }

    return {
      metric,
      value,
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
    };
  }
}
