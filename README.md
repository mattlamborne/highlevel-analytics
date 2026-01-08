# HighLevel Analytics

A production-ready multi-tenant SaaS application that tracks business metrics (Leads, Bookings, Sales, Churn, LTV) for GoHighLevel clients using their API.

## Features

- **Multi-tenant architecture** - Isolate data per tenant/location
- **OAuth2 integration** - Secure installation flow with HighLevel
- **Real-time webhooks** - Instant updates when contacts, opportunities, or appointments change
- **Background jobs** - Async processing with BullMQ + Redis
- **Reconciliation** - Nightly sync to backfill missed webhooks
- **Metrics API** - Query leads, bookings, sales, churn, LTV with flexible date ranges
- **Subscription tracking** - Model lifetime value based on start/departing dates

## Tech Stack

- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **Queue**: pg-boss (PostgreSQL-based - no Redis needed!)
- **API Client**: Axios (for HighLevel API)
- **Security**: AES-256-GCM token encryption

**Why PostgreSQL-Only:**
- ✅ Simpler - one database vs database + Redis
- ✅ Cheaper - Supabase free tier (no Redis costs)
- ✅ Easier - no Docker needed locally
- ✅ All data in one place

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** and **npm** installed
2. A **Supabase** account (free tier - sign up at https://supabase.com)
3. A **HighLevel** account (for creating an app)

### Install Prerequisites

See [SETUP.md](./SETUP.md) for detailed installation instructions for Node.js.

## Quick Start

### 1. Create Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Click "New Project"
3. Choose organization, project name, database password, region
4. Wait ~2 minutes for project creation
5. Go to **Project Settings → Database**
6. Copy the **Connection pooling** URL (should look like: `postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres`)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in required values:

```env
# Paste your Supabase connection string
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Generate encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<generated_key_here>

# Get GHL credentials from HighLevel App setup (see below)
GHL_CLIENT_ID=your_client_id
GHL_CLIENT_SECRET=your_client_secret
```

### 4. Run Migrations

```bash
npm run migrate
```

This creates all tables in your Supabase database (including pg-boss job queue tables).

### 5. Start Development Server

```bash
npm run start:dev
```

The API runs at `http://localhost:3000`

Test it:
```bash
curl http://localhost:3000/health
```

## HighLevel App Setup

To integrate with HighLevel, you need to create a HighLevel App:

### Steps:

1. Log into your HighLevel account
2. Navigate to **Settings → Integrations → App Marketplace → Build App**
3. Click **Create Private App** (or Public App for multi-agency)
4. Fill in app details:
   - **App Name**: HighLevel Analytics
   - **Redirect URI**: `http://localhost:3000/auth/ghl/callback`
   - **Scopes**: Select the following:
     - `contacts.readonly`
     - `opportunities.readonly`
     - `calendars/events.readonly`
     - `locations.readonly`
5. Save and copy **Client ID** and **Client Secret**
6. Paste these values into your `.env` file

## Usage

### 1. Create a Tenant

```bash
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "createdAt": "2025-01-08T10:00:00.000Z",
  "updatedAt": "2025-01-08T10:00:00.000Z"
}
```

### 2. Complete OAuth Installation

Open in browser:
```
http://localhost:3000/auth/ghl/start?tenant_id=550e8400-e29b-41d4-a716-446655440000
```

1. You'll be redirected to HighLevel to authorize
2. After approval, you'll be redirected back to your app
3. Tokens are encrypted and stored in `ghl_installations` table

### 3. Configure Webhooks

In HighLevel App settings, add webhook endpoint:

```
https://your-domain.com/webhooks/ghl
```

Subscribe to events:
- `contact.create`
- `contact.update`
- `opportunity.create`
- `opportunity.update`
- `appointment.create`
- `appointment.update`

### 4. Set Metric Rules

Each location needs configuration for custom field mappings:

```bash
curl -X PUT http://localhost:3000/metric-rules/{tenantId}/{locationId} \
  -H "Content-Type: application/json" \
  -d '{
    "startDateFieldKey": "membership_start_date",
    "departingDateFieldKey": "membership_end_date",
    "mrrSource": "opportunity_value"
  }'
```

### 5. Query Metrics

```bash
# Get summary metrics
curl "http://localhost:3000/metrics?tenant_id={ID}&location_id={ID}&from=2025-01-01&to=2025-12-31"
```

Response:
```json
{
  "leads": 150,
  "bookings": 45,
  "sales": 12,
  "churn": 3,
  "activeSubscribers": 87,
  "avgLTV": 4250.00
}
```

```bash
# Get timeseries data
curl "http://localhost:3000/metrics/timeseries?tenant_id={ID}&location_id={ID}&metric=sales&grain=month&from=2025-01-01&to=2025-12-31"
```

Response:
```json
[
  { "date": "2025-01", "value": 5 },
  { "date": "2025-02", "value": 7 }
]
```

## Architecture

### Data Flow

1. **Webhook arrives** → Validated → Stored in `events` table → Enqueued for processing
2. **Processor job** → Fetches latest data from HighLevel API → Updates cache tables
3. **Subscription logic** → Detects opportunity WON transitions → Creates/updates subscription record
4. **Metrics queries** → Aggregate from cache tables → Return to API consumer

### Database Schema

#### Core Tables

- `tenants` - Multi-tenant isolation
- `ghl_installations` - OAuth tokens per location (encrypted)
- `events` - Append-only event log (webhook + reconciliation)
- `contacts_cache` - Contact data mirror
- `opportunities_cache` - Opportunity data mirror (tracks `won_at`)
- `appointments_cache` - Appointment data mirror
- `subscriptions` - Subscription lifecycle (start/departing dates, MRR, LTV)
- `metric_rules` - Per-location field mapping config

### Key Business Rules

- **Sale** = Opportunity status transitions to `WON` (first-time only per opportunity)
- **Churn** = Contact's `departing_date` <= today
- **LTV** = MRR × tenure_months (from `start_date` to `departing_date` or now)
- **Status calculation**:
  - `scheduled` if start_date in future
  - `active` if start_date <= today and no departing_date (or departing_date > today)
  - `churned` if departing_date <= today

## Development

### Scripts

```bash
# Development
npm run start:dev          # Hot reload

# Build
npm run build
npm run start:prod

# Database
npm run migration:generate # Generate new migration
npm run migrate            # Run migrations
npm run db:studio          # Open Drizzle Studio

# Testing
npm test                   # Unit tests
npm run test:e2e           # E2E tests
npm run test:cov           # Coverage

# Code Quality
npm run lint
npm run format
```

### Project Structure

```
src/
├── main.ts                    # Entry point
├── app.module.ts              # Root module
├── config/                    # Environment configuration
├── database/                  # Drizzle schema + migrations
├── crypto/                    # Token encryption service
├── tenants/                   # Tenant management
├── auth/                      # OAuth flow
├── ghl-client/                # HighLevel API client
├── webhooks/                  # Webhook receiver
├── events/                    # Event processing
├── jobs/                      # BullMQ workers
├── cache/                     # Cache repositories
├── subscriptions/             # Subscription lifecycle
├── metrics/                   # Metrics queries + API
└── metric-rules/              # Field mapping config
```

## Testing

### Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

### Key Test Scenarios

- **Subscription status calculation** - Test all edge cases (scheduled, active, churned)
- **LTV calculation** - Active vs churned, tenure edge cases
- **Won transition detection** - Idempotent first-win logic
- **Token refresh** - Auto-refresh on 401, retry logic
- **Webhook deduplication** - `dedupe_key` uniqueness

## Deployment

### Environment Variables (Production)

Ensure these are set in production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...      # Managed Postgres (e.g., Supabase, RDS)
REDIS_URL=redis://...              # Managed Redis (e.g., Upstash, ElastiCache)
ENCRYPTION_KEY=...                 # 64-char hex (keep secret!)
GHL_CLIENT_ID=...
GHL_CLIENT_SECRET=...
GHL_REDIRECT_URI=https://yourdomain.com/auth/ghl/callback
APP_URL=https://yourdomain.com
```

### Production Checklist

- [ ] Use managed Postgres (connection pooling)
- [ ] Use managed Redis (persistence enabled)
- [ ] Rotate `ENCRYPTION_KEY` carefully (decrypt old tokens first!)
- [ ] Enable SSL for database connections
- [ ] Scale BullMQ workers horizontally as needed
- [ ] Monitor queue depths (BullMQ dashboard)
- [ ] Setup error tracking (Sentry/DataDog)
- [ ] Rate limit API endpoints
- [ ] Add authentication/authorization (currently open)
- [ ] Configure CORS properly

## Troubleshooting

### Database connection errors

```bash
# Check containers are running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### Redis connection errors

```bash
docker-compose logs redis
docker-compose restart redis
```

### HighLevel API rate limits

HighLevel has rate limits (~600 requests/minute). The client implements exponential backoff. If you hit limits frequently:

- Reduce reconciliation frequency
- Batch API calls
- Use webhook-first approach (minimize polling)

### Webhook signature verification fails

- Ensure webhook secret matches config
- Check HighLevel docs for signature format
- Verification is modular - can be disabled per installation

## API Reference

### Tenants

- `POST /tenants` - Create tenant
- `GET /tenants` - List tenants
- `GET /tenants/:id` - Get tenant details
- `PUT /tenants/:id` - Update tenant
- `DELETE /tenants/:id` - Delete tenant

### Auth

- `GET /auth/ghl/start?tenant_id={id}` - Start OAuth flow
- `GET /auth/ghl/callback` - OAuth callback (handled automatically)

### Metrics

- `GET /metrics?tenant_id&location_id&from&to` - Summary metrics
- `GET /metrics/timeseries?metric&grain&from&to` - Timeseries data
- `GET /metrics/cohorts?tenant_id&location_id` - Cohort LTV analysis

### Metric Rules

- `GET /metric-rules/:tenantId/:locationId` - Get current rules
- `PUT /metric-rules/:tenantId/:locationId` - Update field mappings
- `POST /metric-rules/:tenantId/:locationId/test` - Test field parsing

### Debug (Admin)

- `GET /debug/events?tenant_id&location_id&from&to` - Event log
- `POST /debug/reconcile/:locationId` - Trigger manual reconciliation

## Contributing

This is a private project. For questions or issues, contact the maintainer.

## License

MIT
