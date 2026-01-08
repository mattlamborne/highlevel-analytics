import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { ghlInstallations, NewGhlInstallation } from '../database/schema';
import { CryptoService } from '../crypto/crypto.service';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  userType: string;
  locationId?: string;
  companyId?: string;
}

@Injectable()
export class AuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly ghlApiBase: string;
  private readonly appVersionId: string;

  constructor(
    @Inject(DRIZZLE_TOKEN) private db: DrizzleDB,
    private configService: ConfigService,
    private cryptoService: CryptoService,
  ) {
    this.clientId = this.configService.get<string>('ghl.clientId')!;
    this.clientSecret = this.configService.get<string>('ghl.clientSecret')!;
    this.redirectUri = this.configService.get<string>('ghl.redirectUri')!;
    this.ghlApiBase = this.configService.get<string>('ghl.apiBaseUrl')!;
    this.appVersionId = this.configService.get<string>('ghl.appVersionId')!;
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(tenantId: string): string {
    // HighLevel OAuth uses marketplace domain, not API domain
    const baseUrl = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'contacts.readonly opportunities.readonly calendars/events.readonly',
      state: tenantId, // Pass tenant_id as state
      version_id: this.appVersionId,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, tenantId: string): Promise<void> {
    try {
      const response = await axios.post<TokenResponse>(
        `${this.ghlApiBase}/oauth/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData = response.data;

      // Log the token response to debug what fields we're getting
      console.log('Token response data:', JSON.stringify(tokenData, null, 2));

      // Handle both company-level and location-level installations
      // Company-level: companyId present, no locationId (bulk installation)
      // Location-level: both companyId and locationId present
      const companyId = tokenData.companyId || '';
      const locationId = tokenData.locationId || companyId; // Use companyId as fallback

      if (!companyId) {
        console.error('Token response missing both companyId and locationId. Full response:', tokenData);
        throw new BadRequestException('No company_id or location_id in token response');
      }

      console.log(`Installation type: ${tokenData.locationId ? 'Location' : 'Company'}-level. CompanyId: ${companyId}, LocationId: ${locationId}`);

      // Encrypt tokens
      const accessTokenEnc = this.cryptoService.encrypt(tokenData.access_token);
      const refreshTokenEnc = this.cryptoService.encrypt(tokenData.refresh_token);

      // Calculate expires_at
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Upsert installation
      const installation: NewGhlInstallation = {
        tenantId,
        companyId,
        locationId,
        accessTokenEnc,
        refreshTokenEnc,
        expiresAt,
        scopes: tokenData.scope,
        status: 'active',
      };

      await this.db
        .insert(ghlInstallations)
        .values(installation)
        .onConflictDoUpdate({
          target: ghlInstallations.locationId,
          set: {
            accessTokenEnc,
            refreshTokenEnc,
            expiresAt,
            scopes: tokenData.scope,
            status: 'active',
            updatedAt: new Date(),
          },
        });
    } catch (error: any) {
      console.error('Token exchange failed:', error.response?.data || error.message);
      throw new BadRequestException('Failed to exchange authorization code');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(locationId: string): Promise<void> {
    const [installation] = await this.db
      .select()
      .from(ghlInstallations)
      .where(eq(ghlInstallations.locationId, locationId));

    if (!installation) {
      throw new BadRequestException('Installation not found');
    }

    const refreshToken = this.cryptoService.decrypt(installation.refreshTokenEnc);

    try {
      const response = await axios.post<TokenResponse>(
        `${this.ghlApiBase}/oauth/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData = response.data;

      // Encrypt new tokens
      const accessTokenEnc = this.cryptoService.encrypt(tokenData.access_token);
      const refreshTokenEnc = this.cryptoService.encrypt(tokenData.refresh_token);

      // Calculate new expires_at
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Update installation
      await this.db
        .update(ghlInstallations)
        .set({
          accessTokenEnc,
          refreshTokenEnc,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(ghlInstallations.locationId, locationId));
    } catch (error: any) {
      console.error('Token refresh failed:', error.response?.data || error.message);

      // Mark installation as error
      await this.db
        .update(ghlInstallations)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(ghlInstallations.locationId, locationId));

      throw new BadRequestException('Failed to refresh access token');
    }
  }

  /**
   * Get installation by location ID
   */
  async getInstallation(locationId: string) {
    const [installation] = await this.db
      .select()
      .from(ghlInstallations)
      .where(eq(ghlInstallations.locationId, locationId));

    return installation || null;
  }
}
