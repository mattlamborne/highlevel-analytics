import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { appointmentsCache } from '../database/schema';
import { and, eq } from 'drizzle-orm';

export interface UpsertAppointmentDto {
  tenantId: string;
  locationId: string;
  appointmentId: string;
  contactId?: string;
  calendarId?: string;
  startTime: Date;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  raw?: Record<string, any>;
}

@Injectable()
export class AppointmentsCacheRepository {
  private readonly logger = new Logger(AppointmentsCacheRepository.name);

  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  /**
   * Upsert an appointment (insert or update)
   */
  async upsert(dto: UpsertAppointmentDto): Promise<void> {
    await this.db
      .insert(appointmentsCache)
      .values({
        tenantId: dto.tenantId,
        locationId: dto.locationId,
        appointmentId: dto.appointmentId,
        contactId: dto.contactId || null,
        calendarId: dto.calendarId || null,
        startTime: dto.startTime,
        status: dto.status || null,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        raw: dto.raw || null,
      })
      .onConflictDoUpdate({
        target: [
          appointmentsCache.tenantId,
          appointmentsCache.locationId,
          appointmentsCache.appointmentId,
        ],
        set: {
          contactId: dto.contactId || null,
          calendarId: dto.calendarId || null,
          startTime: dto.startTime,
          status: dto.status || null,
          updatedAt: dto.updatedAt,
          raw: dto.raw || null,
        },
      });

    this.logger.debug(`Appointment upserted: ${dto.appointmentId}`);
  }

  /**
   * Find an appointment by ID
   */
  async findById(
    tenantId: string,
    locationId: string,
    appointmentId: string,
  ) {
    const result = await this.db
      .select()
      .from(appointmentsCache)
      .where(
        and(
          eq(appointmentsCache.tenantId, tenantId),
          eq(appointmentsCache.locationId, locationId),
          eq(appointmentsCache.appointmentId, appointmentId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find appointments created within a date range
   */
  async findInRange(
    tenantId: string,
    locationId: string,
    from: Date,
    to: Date,
  ) {
    const result = await this.db
      .select()
      .from(appointmentsCache)
      .where(
        and(
          eq(appointmentsCache.tenantId, tenantId),
          eq(appointmentsCache.locationId, locationId),
        ),
      );

    // Filter by date range in memory (can optimize with SQL later)
    return result.filter((apt) => {
      return apt.createdAt >= from && apt.createdAt <= to;
    });
  }
}
