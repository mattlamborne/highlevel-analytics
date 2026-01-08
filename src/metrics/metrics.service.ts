import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import {
  contactsCache,
  appointmentsCache,
  opportunitiesCache,
  subscriptions,
} from '../database/schema';
import { and, eq, isNotNull, count } from 'drizzle-orm';
import { SubscriptionCalculatorService } from '../subscriptions/subscription-calculator.service';

interface MetricsQuery {
  tenantId: string;
  locationId: string;
  from: Date;
  to: Date;
}

interface MetricsResponse {
  leads: number;
  bookings: number;
  sales: number;
  churn: number;
  activeSubscribers: number;
  avgLTV: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private db: DrizzleDB,
    private readonly calculator: SubscriptionCalculatorService,
  ) {}

  /**
   * Get all metrics for a time period
   */
  async getMetrics(query: MetricsQuery): Promise<MetricsResponse> {
    const [leads, bookings, sales, churn, activeSubscribers, avgLTV] =
      await Promise.all([
        this.getLeadsCount(query),
        this.getBookingsCount(query),
        this.getSalesCount(query),
        this.getChurnCount(query),
        this.getActiveSubscribersCount(query),
        this.getAverageLTV(query),
      ]);

    return {
      leads,
      bookings,
      sales,
      churn,
      activeSubscribers,
      avgLTV,
    };
  }

  /**
   * Count new leads (contacts created) in time period
   */
  async getLeadsCount(query: MetricsQuery): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(contactsCache)
      .where(
        and(
          eq(contactsCache.tenantId, query.tenantId),
          eq(contactsCache.locationId, query.locationId),
        ),
      );

    // Filter by date range in memory
    const allContacts = await this.db
      .select()
      .from(contactsCache)
      .where(
        and(
          eq(contactsCache.tenantId, query.tenantId),
          eq(contactsCache.locationId, query.locationId),
        ),
      );

    const filteredCount = allContacts.filter((contact) => {
      const createdAt = new Date(contact.createdAt);
      return createdAt >= query.from && createdAt <= query.to;
    }).length;

    return filteredCount;
  }

  /**
   * Count new bookings (appointments created) in time period
   */
  async getBookingsCount(query: MetricsQuery): Promise<number> {
    const allAppointments = await this.db
      .select()
      .from(appointmentsCache)
      .where(
        and(
          eq(appointmentsCache.tenantId, query.tenantId),
          eq(appointmentsCache.locationId, query.locationId),
        ),
      );

    const filteredCount = allAppointments.filter((apt) => {
      if (apt.status?.toLowerCase() === 'cancelled') return false;
      const createdAt = new Date(apt.createdAt);
      return createdAt >= query.from && createdAt <= query.to;
    }).length;

    return filteredCount;
  }

  /**
   * Count sales (opportunities marked as WON) in time period
   */
  async getSalesCount(query: MetricsQuery): Promise<number> {
    const allOpportunities = await this.db
      .select()
      .from(opportunitiesCache)
      .where(
        and(
          eq(opportunitiesCache.tenantId, query.tenantId),
          eq(opportunitiesCache.locationId, query.locationId),
          eq(opportunitiesCache.status, 'won'),
          isNotNull(opportunitiesCache.wonAt),
        ),
      );

    const filteredCount = allOpportunities.filter((opp) => {
      if (!opp.wonAt) return false;
      const wonAt = new Date(opp.wonAt);
      return wonAt >= query.from && wonAt <= query.to;
    }).length;

    return filteredCount;
  }

  /**
   * Count churned subscriptions in time period
   */
  async getChurnCount(query: MetricsQuery): Promise<number> {
    const allSubscriptions = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, query.tenantId),
          eq(subscriptions.locationId, query.locationId),
          eq(subscriptions.status, 'churned'),
        ),
      );

    const filteredCount = allSubscriptions.filter((sub) => {
      if (!sub.departingDate) return false;
      const departingDate = new Date(sub.departingDate);
      return departingDate >= query.from && departingDate <= query.to;
    }).length;

    return filteredCount;
  }

  /**
   * Count active subscribers at a specific point in time
   */
  async getActiveSubscribersCount(query: MetricsQuery): Promise<number> {
    const allSubscriptions = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, query.tenantId),
          eq(subscriptions.locationId, query.locationId),
        ),
      );

    // Count subscriptions that are active at query.to
    const activeCount = allSubscriptions.filter((sub) => {
      const startDate = sub.startDate ? new Date(sub.startDate) : null;
      const departingDate = sub.departingDate
        ? new Date(sub.departingDate)
        : null;

      // Use calculator to determine status at query.to
      const status = this.calculator.calculateStatus(
        startDate,
        departingDate,
        query.to,
      );

      return status === 'active';
    }).length;

    return activeCount;
  }

  /**
   * Calculate average LTV across all subscriptions
   */
  async getAverageLTV(query: MetricsQuery): Promise<number> {
    const allSubscriptions = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, query.tenantId),
          eq(subscriptions.locationId, query.locationId),
        ),
      );

    if (allSubscriptions.length === 0) {
      return 0;
    }

    // Calculate LTV for each subscription
    const ltvValues = allSubscriptions
      .map((sub) => {
        const mrr = sub.mrr ? parseFloat(sub.mrr) : null;
        const startDate = sub.startDate ? new Date(sub.startDate) : null;
        const departingDate = sub.departingDate
          ? new Date(sub.departingDate)
          : null;

        return this.calculator.calculateLTV(mrr, startDate, departingDate);
      })
      .filter((ltv) => ltv > 0); // Only include subscriptions with valid LTV

    if (ltvValues.length === 0) {
      return 0;
    }

    const sum = ltvValues.reduce((acc, ltv) => acc + ltv, 0);
    return Math.round(sum / ltvValues.length);
  }
}
