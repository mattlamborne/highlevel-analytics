import { Injectable, Logger } from '@nestjs/common';
import { EventsRepository } from '../../events/events.repository';
import { ContactsCacheRepository } from '../../cache/contacts-cache.repository';
import { OpportunitiesCacheRepository } from '../../cache/opportunities-cache.repository';
import { AppointmentsCacheRepository } from '../../cache/appointments-cache.repository';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { MetricRulesRepository } from '../../metric-rules/metric-rules.repository';
import { GhlClientService } from '../../ghl-client/ghl-client.service';

interface WebhookJob {
  eventId: string;
  tenantId: string;
  locationId: string;
  eventType: string;
}

@Injectable()
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly eventsRepo: EventsRepository,
    private readonly contactsCache: ContactsCacheRepository,
    private readonly opportunitiesCache: OpportunitiesCacheRepository,
    private readonly appointmentsCache: AppointmentsCacheRepository,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly metricRulesRepo: MetricRulesRepository,
    private readonly ghlClient: GhlClientService,
  ) {}

  /**
   * Process a webhook event job
   * This is called by pg-boss for each queued webhook event
   */
  async process(job: WebhookJob): Promise<void> {
    this.logger.debug(`Processing webhook job: ${job.eventId} (${job.eventType})`);

    try {
      // Fetch the event from database
      const event = await this.eventsRepo.findById(job.eventId);
      if (!event) {
        this.logger.warn(`Event not found: ${job.eventId}`);
        return;
      }

      // Route to appropriate handler based on event type
      if (event.eventType.includes('contact')) {
        await this.processContactEvent(event);
      } else if (event.eventType.includes('opportunity')) {
        await this.processOpportunityEvent(event);
      } else if (event.eventType.includes('appointment') || event.eventType.includes('calendar')) {
        await this.processAppointmentEvent(event);
      } else {
        this.logger.debug(`Unhandled event type: ${event.eventType}`);
      }

      this.logger.log(`Webhook processed successfully: ${job.eventId}`);
    } catch (error) {
      this.logger.error(`Error processing webhook job ${job.eventId}:`, error);
      throw error; // Re-throw so pg-boss can retry
    }
  }

  /**
   * Process contact-related events (create, update, delete)
   */
  private async processContactEvent(event: any): Promise<void> {
    const contactId = event.externalId || event.payload.id || event.payload.contactId;

    if (!contactId) {
      this.logger.warn('No contact ID found in event payload');
      return;
    }

    this.logger.debug(`Processing contact event: ${contactId}`);

    // Fetch fresh contact data from HighLevel API
    const contact = await this.ghlClient.getContact(event.locationId, contactId);

    if (!contact) {
      this.logger.warn(`Contact not found in HighLevel: ${contactId}`);
      return;
    }

    // Update contacts cache
    await this.contactsCache.upsert({
      tenantId: event.tenantId,
      locationId: event.locationId,
      contactId: contact.id,
      email: contact.email,
      phone: contact.phone,
      name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      createdAt: new Date(contact.dateAdded || Date.now()),
      updatedAt: new Date(contact.dateUpdated || Date.now()),
      customFields: contact.customFields || {},
    });

    // Update subscription if exists (custom fields may have changed)
    const metricRules = await this.metricRulesRepo.getOrCreateDefault(
      event.tenantId,
      event.locationId,
    );

    await this.subscriptionsService.updateFromContact(
      {
        tenantId: event.tenantId,
        locationId: event.locationId,
        contactId: contact.id,
        customFields: contact.customFields || {},
      },
      metricRules,
    );
  }

  /**
   * Process opportunity-related events (create, update, delete, status change)
   */
  private async processOpportunityEvent(event: any): Promise<void> {
    const opportunityId = event.externalId || event.payload.id || event.payload.opportunityId;

    if (!opportunityId) {
      this.logger.warn('No opportunity ID found in event payload');
      return;
    }

    this.logger.debug(`Processing opportunity event: ${opportunityId}`);

    // Fetch fresh opportunity data from HighLevel API
    const opportunity = await this.ghlClient.getOpportunity(event.locationId, opportunityId);

    if (!opportunity) {
      this.logger.warn(`Opportunity not found in HighLevel: ${opportunityId}`);
      return;
    }

    // Check if this is a first-time WON transition
    const existing = await this.opportunitiesCache.findById(
      event.tenantId,
      event.locationId,
      opportunityId,
    );

    const isFirstWin =
      opportunity.status?.toLowerCase() === 'won' &&
      (!existing || !existing.wonAt);

    // Update opportunities cache
    await this.opportunitiesCache.upsert({
      tenantId: event.tenantId,
      locationId: event.locationId,
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      pipelineId: opportunity.pipelineId,
      stageId: opportunity.pipelineStageId,
      status: opportunity.status || 'open',
      value: opportunity.monetaryValue,
      createdAt: new Date(opportunity.createdAt || Date.now()),
      updatedAt: new Date(opportunity.updatedAt || Date.now()),
      wonAt: opportunity.status?.toLowerCase() === 'won'
        ? new Date(opportunity.updatedAt || Date.now())
        : null,
      raw: opportunity,
    });

    // If this is a first-time win, create/update subscription
    if (isFirstWin && opportunity.contactId) {
      this.logger.log(`First-time opportunity win detected: ${opportunityId}`);

      const metricRules = await this.metricRulesRepo.getOrCreateDefault(
        event.tenantId,
        event.locationId,
      );

      await this.subscriptionsService.handleOpportunityWon(
        {
          tenantId: event.tenantId,
          locationId: event.locationId,
          opportunityId: opportunity.id,
          contactId: opportunity.contactId,
          value: opportunity.monetaryValue,
          wonAt: new Date(opportunity.updatedAt || Date.now()),
          status: opportunity.status || 'won',
        },
        metricRules,
      );
    }
  }

  /**
   * Process appointment-related events (create, update, delete)
   */
  private async processAppointmentEvent(event: any): Promise<void> {
    const appointmentId = event.externalId || event.payload.id || event.payload.appointmentId || event.payload.eventId;

    if (!appointmentId) {
      this.logger.warn('No appointment ID found in event payload');
      return;
    }

    this.logger.debug(`Processing appointment event: ${appointmentId}`);

    // Fetch fresh appointment data from HighLevel API
    const appointment = await this.ghlClient.getAppointment(event.locationId, appointmentId);

    if (!appointment) {
      this.logger.warn(`Appointment not found in HighLevel: ${appointmentId}`);
      return;
    }

    // Update appointments cache
    await this.appointmentsCache.upsert({
      tenantId: event.tenantId,
      locationId: event.locationId,
      appointmentId: appointment.id,
      contactId: appointment.contactId,
      calendarId: appointment.calendarId,
      startTime: new Date(appointment.startTime || Date.now()),
      status: appointment.status || appointment.appointmentStatus,
      createdAt: new Date(appointment.createdAt || Date.now()),
      updatedAt: new Date(appointment.updatedAt || Date.now()),
      raw: appointment,
    });
  }
}
