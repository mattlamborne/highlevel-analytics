import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { ghlInstallations } from '../database/schema';
import { CryptoService } from '../crypto/crypto.service';
import {
  GhlContact,
  GhlContactsResponse,
  GetContactsParams,
} from './types/contact.types';
import {
  GhlOpportunity,
  GhlOpportunitiesResponse,
  GetOpportunitiesParams,
} from './types/opportunity.types';
import {
  GhlAppointment,
  GhlAppointmentsResponse,
  GetAppointmentsParams,
} from './types/appointment.types';

@Injectable()
export class GhlClientService {
  private readonly apiBaseUrl: string;
  private readonly httpClient: AxiosInstance;

  constructor(
    @Inject(DRIZZLE_TOKEN) private db: DrizzleDB,
    private configService: ConfigService,
    private cryptoService: CryptoService,
  ) {
    this.apiBaseUrl = this.configService.get<string>('ghl.apiBaseUrl')!;
    this.httpClient = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
    });
  }

  /**
   * Get access token for a location
   */
  private async getAccessToken(locationId: string): Promise<string> {
    const [installation] = await this.db
      .select()
      .from(ghlInstallations)
      .where(eq(ghlInstallations.locationId, locationId));

    if (!installation || installation.status !== 'active') {
      throw new UnauthorizedException(`No active installation for location ${locationId}`);
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expiresAt = new Date(installation.expiresAt);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow) {
      // Token expired or expiring soon, refresh it
      await this.refreshToken(locationId);

      // Fetch updated installation
      const [updated] = await this.db
        .select()
        .from(ghlInstallations)
        .where(eq(ghlInstallations.locationId, locationId));

      return this.cryptoService.decrypt(updated.accessTokenEnc);
    }

    return this.cryptoService.decrypt(installation.accessTokenEnc);
  }

  /**
   * Refresh access token
   */
  private async refreshToken(locationId: string): Promise<void> {
    const [installation] = await this.db
      .select()
      .from(ghlInstallations)
      .where(eq(ghlInstallations.locationId, locationId));

    if (!installation) {
      throw new UnauthorizedException('Installation not found');
    }

    const refreshToken = this.cryptoService.decrypt(installation.refreshTokenEnc);
    const clientId = this.configService.get<string>('ghl.clientId')!;
    const clientSecret = this.configService.get<string>('ghl.clientSecret')!;

    try {
      const response = await axios.post(`${this.apiBaseUrl}/oauth/token`, {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token, expires_in } = response.data;

      const accessTokenEnc = this.cryptoService.encrypt(access_token);
      const refreshTokenEnc = this.cryptoService.encrypt(refresh_token);
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      await this.db
        .update(ghlInstallations)
        .set({ accessTokenEnc, refreshTokenEnc, expiresAt, updatedAt: new Date() })
        .where(eq(ghlInstallations.locationId, locationId));
    } catch (error: any) {
      console.error('Token refresh failed:', error.response?.data || error.message);
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  /**
   * Make authenticated API request with automatic retry on 401
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    locationId: string,
    data?: any,
    params?: any,
    retryCount = 0,
  ): Promise<T> {
    try {
      const accessToken = await this.getAccessToken(locationId);

      const response = await this.httpClient.request<T>({
        method,
        url,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: '2021-07-28',
        },
        data,
        params,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Retry on 401 (once)
        if (axiosError.response?.status === 401 && retryCount === 0) {
          await this.refreshToken(locationId);
          return this.makeRequest<T>(method, url, locationId, data, params, retryCount + 1);
        }

        // Rate limit handling (429)
        if (axiosError.response?.status === 429) {
          const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '60', 10);
          await this.sleep(retryAfter * 1000);
          return this.makeRequest<T>(method, url, locationId, data, params, retryCount);
        }

        console.error('HighLevel API error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          url,
        });
      }

      throw error;
    }
  }

  /**
   * Sleep utility for rate limit backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get contacts
   */
  async getContacts(
    locationId: string,
    params?: GetContactsParams,
  ): Promise<GhlContactsResponse> {
    return this.makeRequest<GhlContactsResponse>(
      'GET',
      `/contacts`,
      locationId,
      undefined,
      { locationId, ...params },
    );
  }

  /**
   * Get single contact
   */
  async getContact(locationId: string, contactId: string): Promise<GhlContact> {
    const response = await this.makeRequest<{ contact: GhlContact }>(
      'GET',
      `/contacts/${contactId}`,
      locationId,
    );
    return response.contact;
  }

  /**
   * Get opportunities
   */
  async getOpportunities(
    locationId: string,
    params?: GetOpportunitiesParams,
  ): Promise<GhlOpportunitiesResponse> {
    return this.makeRequest<GhlOpportunitiesResponse>(
      'GET',
      `/opportunities`,
      locationId,
      undefined,
      { locationId, ...params },
    );
  }

  /**
   * Get single opportunity
   */
  async getOpportunity(locationId: string, opportunityId: string): Promise<GhlOpportunity> {
    const response = await this.makeRequest<{ opportunity: GhlOpportunity }>(
      'GET',
      `/opportunities/${opportunityId}`,
      locationId,
    );
    return response.opportunity;
  }

  /**
   * Get appointments (calendar events)
   */
  async getAppointments(
    locationId: string,
    params?: GetAppointmentsParams,
  ): Promise<GhlAppointmentsResponse> {
    return this.makeRequest<GhlAppointmentsResponse>(
      'GET',
      `/calendars/events`,
      locationId,
      undefined,
      { locationId, ...params },
    );
  }

  /**
   * Get single appointment
   */
  async getAppointment(locationId: string, appointmentId: string): Promise<GhlAppointment> {
    const response = await this.makeRequest<{ event: GhlAppointment }>(
      'GET',
      `/calendars/events/${appointmentId}`,
      locationId,
    );
    return response.event;
  }
}
