# HighLevel Analytics - Setup Guide

## Prerequisites Installation

### 1. Install Node.js (Required)

**Using Homebrew (Recommended for macOS):**
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 18 or later
brew install node@20
```

**Alternative - Using NVM:**
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart your terminal, then install Node.js
nvm install 20
nvm use 20
```

**Verify Installation:**
```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x or later
```

### 2. Install Docker (Required)

Download and install Docker Desktop from: https://www.docker.com/products/docker-desktop

Verify installation:
```bash
docker --version
docker-compose --version
```

---

## Project Setup

Once Node.js and Docker are installed:

### 1. Install Dependencies
```bash
cd highlevel-analytics
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and fill in your values:
- `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` from HighLevel App
- `ENCRYPTION_KEY` - generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Database and Redis URLs (default values work for local Docker setup)

### 3. Start Database and Redis
```bash
docker-compose up -d
```

### 4. Run Database Migrations
```bash
npm run migrate
```

### 5. Start Development Server
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

---

## HighLevel App Configuration

Before you can use OAuth, you need to create a HighLevel App:

1. Log into your HighLevel account
2. Navigate to **Settings → Integrations → Apps**
3. Click **Create App**
4. Fill in:
   - **App Name:** HighLevel Analytics
   - **Redirect URI:** `http://localhost:3000/auth/ghl/callback`
   - **Scopes:** Select:
     - `contacts.readonly`
     - `opportunities.readonly`
     - `calendars/events.readonly`
5. Copy the **Client ID** and **Client Secret** to your `.env` file

---

## Next Steps

After setup is complete:

1. **Create a tenant:**
   ```bash
   curl -X POST http://localhost:3000/tenants \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Company"}'
   ```

2. **Complete OAuth flow:**
   - Open browser: `http://localhost:3000/auth/ghl/start?tenant_id={TENANT_ID}`
   - Authorize the app
   - You'll be redirected back with success

3. **Test the API:**
   ```bash
   curl "http://localhost:3000/metrics?tenant_id={ID}&location_id={ID}&from=2025-01-01&to=2025-12-31"
   ```

---

## Troubleshooting

**Port already in use:**
```bash
# Change PORT in .env file
PORT=3001
```

**Database connection errors:**
```bash
# Restart Docker containers
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs postgres
```

**Redis connection errors:**
```bash
docker-compose logs redis
```

---

## Development Commands

```bash
# Start dev server with hot reload
npm run start:dev

# Run tests
npm test

# Run e2e tests
npm run test:e2e

# Generate new migration
npm run migration:generate

# Run migrations
npm run migrate

# Format code
npm run format

# Lint code
npm run lint
```
