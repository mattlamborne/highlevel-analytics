import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../database/drizzle.provider';
import { tenants, NewTenant, Tenant } from '../database/schema';

@Injectable()
export class TenantsRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private db: DrizzleDB) {}

  async create(data: NewTenant): Promise<Tenant> {
    const [tenant] = await this.db.insert(tenants).values(data).returning();
    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.db.select().from(tenants);
  }

  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || null;
  }

  async update(id: string, data: Partial<NewTenant>): Promise<Tenant | null> {
    const [updated] = await this.db
      .update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(tenants).where(eq(tenants.id, id)).returning();
    return result.length > 0;
  }
}
