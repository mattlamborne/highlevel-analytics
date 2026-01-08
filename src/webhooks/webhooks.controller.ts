import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { SignatureVerifierService } from './signature-verifier.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly signatureVerifier: SignatureVerifierService,
  ) {}

  /**
   * Receive webhooks from HighLevel
   * POST /webhooks/ghl?tenant_id=xxx
   */
  @Post('ghl')
  @HttpCode(HttpStatus.OK)
  async receiveGhlWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, any>,
    @Query('tenant_id') tenantId?: string,
  ) {
    this.logger.debug('Received webhook from HighLevel');

    // Validate tenant_id is provided
    if (!tenantId) {
      throw new BadRequestException('tenant_id query parameter is required');
    }

    // Verify webhook signature (optional for now)
    // In production, you should enable strict signature verification
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET || '';
    if (webhookSecret) {
      const isValid = this.signatureVerifier.verifyFromHeaders(
        body,
        headers,
        webhookSecret,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Validate payload structure
    if (!body || !body.type || !body.locationId) {
      throw new BadRequestException(
        'Invalid webhook payload: missing type or locationId',
      );
    }

    // Process webhook
    const result = await this.webhooksService.processWebhook(tenantId, body);

    // Return success response
    return {
      received: true,
      eventId: result.eventId,
      queued: result.queued,
    };
  }

  /**
   * Health check endpoint for webhook service
   * GET /webhooks/health
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return {
      status: 'ok',
      service: 'webhooks',
      timestamp: new Date().toISOString(),
    };
  }
}
