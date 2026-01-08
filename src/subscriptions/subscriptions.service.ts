import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionCalculatorService } from './subscription-calculator.service';
import { ContactsCacheRepository } from '../cache/contacts-cache.repository';

interface OpportunityData {
  tenantId: string;
  locationId: string;
  opportunityId: string;
  contactId: string;
  value?: number;
  wonAt?: Date;
  status: string;
}

interface ContactData {
  tenantId: string;
  locationId: string;
  contactId: string;
  customFields?: Record<string, any>;
}

interface MetricRulesData {
  startDateFieldKey: string;
  departingDateFieldKey: string;
  mrrSource: 'opportunity_value' | 'custom_field';
  mrrCustomFieldKey?: string | null;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly subscriptionsRepo: SubscriptionsRepository,
    private readonly calculator: SubscriptionCalculatorService,
    private readonly contactsCache: ContactsCacheRepository,
  ) {}

  /**
   * Handle when an opportunity is marked as WON for the first time
   * Creates or updates the subscription for the contact
   */
  async handleOpportunityWon(
    opportunity: OpportunityData,
    metricRules: MetricRulesData,
  ): Promise<void> {
    this.logger.debug(
      `Handling opportunity won: ${opportunity.opportunityId} for contact ${opportunity.contactId}`,
    );

    // Fetch contact to get custom fields
    const contact = await this.contactsCache.findById(
      opportunity.tenantId,
      opportunity.locationId,
      opportunity.contactId,
    );

    if (!contact) {
      this.logger.warn(
        `Contact not found in cache: ${opportunity.contactId}. Skipping subscription update.`,
      );
      return;
    }

    // Extract subscription data from contact custom fields
    const customFields = (contact.customFields || {}) as Record<string, any>;
    const startDate = this.calculator.parseDate(
      customFields[metricRules.startDateFieldKey],
    );

    const departingDate = this.calculator.parseDate(
      customFields[metricRules.departingDateFieldKey],
    );

    // Determine MRR based on metric rules
    let mrr: number | null = null;
    if (metricRules.mrrSource === 'opportunity_value') {
      mrr = opportunity.value || null;
    } else if (
      metricRules.mrrSource === 'custom_field' &&
      metricRules.mrrCustomFieldKey
    ) {
      mrr = this.calculator.parseNumber(
        customFields[metricRules.mrrCustomFieldKey],
      );
    }

    // Calculate status
    const status = this.calculator.calculateStatus(startDate, departingDate);

    // Check if subscription already exists
    const existing = await this.subscriptionsRepo.findByContactId(
      opportunity.tenantId,
      opportunity.locationId,
      opportunity.contactId,
    );

    // Upsert subscription
    await this.subscriptionsRepo.upsert({
      tenantId: opportunity.tenantId,
      locationId: opportunity.locationId,
      contactId: opportunity.contactId,
      startDate,
      departingDate,
      mrr,
      status,
      // Only set firstWonAt if this is the first win
      firstWonAt: existing?.firstWonAt || opportunity.wonAt || new Date(),
      lastWonOpportunityId: opportunity.opportunityId,
    });

    this.logger.log(
      `Subscription updated for contact ${opportunity.contactId}: ${status}`,
    );
  }

  /**
   * Update subscription when contact custom fields change
   * (e.g., start_date or departing_date updated)
   */
  async updateFromContact(
    contact: ContactData,
    metricRules: MetricRulesData,
  ): Promise<void> {
    this.logger.debug(`Updating subscription from contact: ${contact.contactId}`);

    // Check if subscription exists
    const existing = await this.subscriptionsRepo.findByContactId(
      contact.tenantId,
      contact.locationId,
      contact.contactId,
    );

    if (!existing) {
      this.logger.debug(
        `No subscription found for contact ${contact.contactId}. Skipping update.`,
      );
      return;
    }

    // Extract new dates from custom fields
    const customFields = (contact.customFields || {}) as Record<string, any>;
    const startDate = this.calculator.parseDate(
      customFields[metricRules.startDateFieldKey],
    );

    const departingDate = this.calculator.parseDate(
      customFields[metricRules.departingDateFieldKey],
    );

    // Extract MRR if from custom field
    let mrr = existing.mrr ? parseFloat(existing.mrr) : null;
    if (
      metricRules.mrrSource === 'custom_field' &&
      metricRules.mrrCustomFieldKey
    ) {
      mrr = this.calculator.parseNumber(
        customFields[metricRules.mrrCustomFieldKey],
      );
    }

    // Recalculate status
    const status = this.calculator.calculateStatus(startDate, departingDate);

    // Update subscription
    await this.subscriptionsRepo.upsert({
      tenantId: contact.tenantId,
      locationId: contact.locationId,
      contactId: contact.contactId,
      startDate,
      departingDate,
      mrr,
      status,
      firstWonAt: existing.firstWonAt,
      lastWonOpportunityId: existing.lastWonOpportunityId,
    });

    this.logger.log(
      `Subscription updated from contact ${contact.contactId}: ${status}`,
    );
  }

  /**
   * Calculate LTV for a specific subscription
   */
  async calculateLTV(
    tenantId: string,
    locationId: string,
    contactId: string,
  ): Promise<number> {
    const subscription = await this.subscriptionsRepo.findByContactId(
      tenantId,
      locationId,
      contactId,
    );

    if (!subscription) {
      return 0;
    }

    const mrr = subscription.mrr ? parseFloat(subscription.mrr) : null;
    const startDate = subscription.startDate ? new Date(subscription.startDate) : null;
    const departingDate = subscription.departingDate ? new Date(subscription.departingDate) : null;

    return this.calculator.calculateLTV(mrr, startDate, departingDate);
  }
}
