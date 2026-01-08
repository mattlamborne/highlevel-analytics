-- HighLevel Analytics Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE installation_status AS ENUM ('active', 'revoked', 'error');
CREATE TYPE event_source AS ENUM ('webhook', 'reconciliation', 'backfill');
CREATE TYPE subscription_status AS ENUM ('scheduled', 'active', 'churned');
CREATE TYPE mrr_source AS ENUM ('opportunity_value', 'custom_field');

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- GHL Installations table
CREATE TABLE ghl_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL,
    location_id TEXT NOT NULL UNIQUE,
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    scopes TEXT NOT NULL,
    status installation_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ghl_installations_tenant_id_idx ON ghl_installations(tenant_id);

-- Events table (append-only event log)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_time TIMESTAMP NOT NULL,
    external_id TEXT,
    dedupe_key TEXT NOT NULL UNIQUE,
    source event_source NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX events_tenant_location_time_idx ON events(tenant_id, location_id, event_time);
CREATE INDEX events_dedupe_key_idx ON events(dedupe_key);

-- Contacts cache table
CREATE TABLE contacts_cache (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    name TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    custom_fields JSONB,
    PRIMARY KEY (tenant_id, location_id, contact_id)
);

CREATE INDEX contacts_cache_tenant_location_created_idx ON contacts_cache(tenant_id, location_id, created_at);

-- Opportunities cache table
CREATE TABLE opportunities_cache (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    opportunity_id TEXT NOT NULL,
    contact_id TEXT,
    pipeline_id TEXT,
    stage_id TEXT,
    status TEXT NOT NULL,
    value NUMERIC(12, 2),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    won_at TIMESTAMP,
    raw JSONB,
    PRIMARY KEY (tenant_id, location_id, opportunity_id)
);

CREATE INDEX opportunities_cache_tenant_location_status_won_idx ON opportunities_cache(tenant_id, location_id, status, won_at);
CREATE INDEX opportunities_cache_contact_id_idx ON opportunities_cache(contact_id);

-- Appointments cache table
CREATE TABLE appointments_cache (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    appointment_id TEXT NOT NULL,
    contact_id TEXT,
    calendar_id TEXT,
    start_time TIMESTAMP NOT NULL,
    status TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    raw JSONB,
    PRIMARY KEY (tenant_id, location_id, appointment_id)
);

CREATE INDEX appointments_cache_tenant_location_created_idx ON appointments_cache(tenant_id, location_id, created_at);

-- Subscriptions table
CREATE TABLE subscriptions (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    start_date DATE,
    departing_date DATE,
    mrr NUMERIC(12, 2),
    status subscription_status NOT NULL DEFAULT 'scheduled',
    first_won_at TIMESTAMP,
    last_won_opportunity_id TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, location_id, contact_id)
);

CREATE INDEX subscriptions_tenant_location_status_idx ON subscriptions(tenant_id, location_id, status);
CREATE INDEX subscriptions_departing_date_idx ON subscriptions(departing_date);

-- Metric rules table
CREATE TABLE metric_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    start_date_field_key TEXT NOT NULL,
    departing_date_field_key TEXT NOT NULL,
    mrr_source mrr_source NOT NULL DEFAULT 'opportunity_value',
    mrr_custom_field_key TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, location_id)
);

-- OAuth states table (for OAuth flow)
CREATE TABLE oauth_states (
    state TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Success message
SELECT 'All tables created successfully!' AS message;
