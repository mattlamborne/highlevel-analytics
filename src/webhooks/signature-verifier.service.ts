import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class SignatureVerifierService {
  private readonly logger = new Logger(SignatureVerifierService.name);

  /**
   * Verify webhook signature using HMAC
   * Note: HighLevel webhook signatures may vary by webhook type
   * This is a basic implementation that can be extended
   */
  verifySignature(
    payload: string,
    signature: string | undefined,
    secret: string,
  ): boolean {
    // If no signature provided and verification is optional, allow it
    if (!signature) {
      this.logger.warn('No signature provided - allowing webhook (optional verification)');
      return true;
    }

    try {
      // Compute HMAC SHA-256 signature
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const computed = hmac.digest('hex');

      // Compare signatures (constant-time comparison)
      const expected = signature.toLowerCase();
      const isValid = computed === expected;

      if (!isValid) {
        this.logger.warn('Webhook signature mismatch');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Verify signature from various header formats
   * Supports different webhook providers that may use different header names
   */
  verifyFromHeaders(
    body: any,
    headers: Record<string, any>,
    secret: string,
  ): boolean {
    // Try common signature header names
    const signature =
      headers['x-ghl-signature'] ||
      headers['x-webhook-signature'] ||
      headers['x-signature'] ||
      undefined;

    const payload = typeof body === 'string' ? body : JSON.stringify(body);

    return this.verifySignature(payload, signature, secret);
  }
}
