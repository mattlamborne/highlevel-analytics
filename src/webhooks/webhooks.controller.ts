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
   * POST /webhooks/ghl
   * HighLevel sends locationId or companyId in the payload, we look up the tenant from our installations
   */
  @Post('ghl')
  @HttpCode(HttpStatus.OK)
  async receiveGhlWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, any>,
  ) {
    this.logger.debug('Received webhook from HighLevel', { type: body?.type, locationId: body?.locationId, companyId: body?.companyId });

    // Validate payload structure
    if (!body || !body.type) {
      throw new BadRequestException('Invalid webhook payload: missing type');
    }

    // Extract locationId or companyId from payload
    const locationId = body.locationId || body.companyId;
    if (!locationId) {
      throw new BadRequestException('Invalid webhook payload: missing locationId or companyId');
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

    // Process webhook (service will look up tenant from locationId)
    const result = await this.webhooksService.processWebhook(locationId, body);

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
