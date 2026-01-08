import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { contactsCache } from '../database/schema';
import { and, eq } from 'drizzle-orm';

export interface UpsertContactDto {
  tenantId: string;
  locationId: string;
  contactId: string;
  email?: string;
  phone?: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  customFields?: Record<string, any>;
}

@Injectable()
export class ContactsCacheRepository {
  private readonly logger = new Logger(ContactsCacheRepository.name);

  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  /**
   * Upsert a contact (insert or update)
   */
  async upsert(dto: UpsertContactDto): Promise<void> {
    await this.db
      .insert(contactsCache)
      .values({
        tenantId: dto.tenantId,
        locationId: dto.locationId,
        contactId: dto.contactId,
        email: dto.email || null,
        phone: dto.phone || null,
        name: dto.name || null,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        customFields: dto.customFields || null,
      })
      .onConflictDoUpdate({
        target: [
          contactsCache.tenantId,
          contactsCache.locationId,
          contactsCache.contactId,
        ],
        set: {
          email: dto.email || null,
          phone: dto.phone || null,
          name: dto.name || null,
          updatedAt: dto.updatedAt,
          customFields: dto.customFields || null,
        },
      });

    this.logger.debug(`Contact upserted: ${dto.contactId}`);
  }

  /**
   * Find a contact by ID
   */
  async findById(tenantId: string, locationId: string, contactId: string) {
    const result = await this.db
      .select()
      .from(contactsCache)
      .where(
        and(
          eq(contactsCache.tenantId, tenantId),
          eq(contactsCache.locationId, locationId),
          eq(contactsCache.contactId, contactId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find contacts by tenant and location
   */
  async findByLocation(tenantId: string, locationId: string, limit = 100) {
    return this.db
      .select()
      .from(contactsCache)
      .where(
        and(
          eq(contactsCache.tenantId, tenantId),
          eq(contactsCache.locationId, locationId),
        ),
      )
      .limit(limit);
  }
}
