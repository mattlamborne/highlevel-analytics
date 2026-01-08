import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const hexKey = this.configService.get<string>('encryption.key')!;
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM
   * Format: iv(16) + authTag(16) + ciphertext
   * Returns base64-encoded string
   */
  encrypt(plaintext: string): string {
    // Generate random initialization vector
    const iv = randomBytes(16);

    // Create cipher
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    // Encrypt
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    // Return base64
    return combined.toString('base64');
  }

  /**
   * Decrypts ciphertext encrypted with encrypt()
   * Expects base64-encoded string in format: iv(16) + authTag(16) + ciphertext
   */
  decrypt(ciphertext: string): string {
    // Decode base64
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract components
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    // Create decipher
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }
}
