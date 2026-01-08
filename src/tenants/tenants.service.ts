import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { Tenant } from '../database/schema';

export interface CreateTenantDto {
  name: string;
}

export interface UpdateTenantDto {
  name?: string;
}

@Injectable()
export class TenantsService {
  constructor(private tenantsRepository: TenantsRepository) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsRepository.create(dto);
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepository.findAll();
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const updated = await this.tenantsRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.tenantsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
  }
}
