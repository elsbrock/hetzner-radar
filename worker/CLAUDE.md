# Cloud Availability Worker Context

## Overview

The Cloud Availability Worker is a Cloudflare Worker that manages two separate Durable Objects to track Hetzner server data:

1. **CloudAvailabilityDO**: Monitors Hetzner Cloud server availability every 60 seconds
2. **AuctionImportDO**: Imports Hetzner dedicated server auction data every 5 minutes

## Technology Stack

- **Runtime**: Cloudflare Workers with TypeScript
- **Architecture**: Durable Objects for stateful processing
- **Storage**: Cloudflare KV for minimal state storage
- **Analytics**: Cloudflare Analytics Engine
- **Build**: Wrangler CLI

## Key Commands

```bash
# Development
npm run dev          # Start development server (wrangler dev)
npm run start        # Alias for dev
npm run deploy       # Deploy to Cloudflare (wrangler deploy)
npm run cf-typegen   # Generate Cloudflare types
```

## Project Structure

```
src/
├── index.ts                      # Main worker entry point & router
├── cloud-availability-do.ts      # Cloud server availability DO
├── auction-import-do.ts          # Auction data import DO
├── cloud-status-service.ts       # Hetzner Cloud API client
├── auction-service.ts            # Auction import orchestration
├── notification-service.ts       # Alerts & analytics reporting
├── http-router.ts                # HTTP endpoint routing
├── hetzner-auction-client.ts     # Hetzner auction API client
├── auction-data-transformer.ts   # Data transformation utilities
└── auction-db-service.ts         # D1 database operations
```

## Architecture

### Durable Objects

- **CloudAvailabilityDO**: Singleton DO (`singleton-cloud-availability-v1`) for cloud status
- **AuctionImportDO**: Singleton DO (`singleton-auction-import-v1`) for auction imports
- Both use scheduled alarms for periodic execution

### Service Layer

- **CloudStatusService**: Fetches Hetzner Cloud availability via API
- **AuctionService**: Orchestrates auction data import process
- **NotificationService**: Handles change notifications and analytics
- **HttpRouter**: Routes HTTP requests to appropriate handlers

## Configuration

### Environment Variables (wrangler.jsonc)

```json
{
	"FETCH_INTERVAL_MS": "60000", // Cloud status check interval
	"AUCTION_IMPORT_INTERVAL_MS": "300000", // Auction import interval (5 min)
	"MAIN_APP_URL": "https://radar.iodev.org",
	"HETZNER_AUCTION_API_URL": "https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json"
}
```

### Secrets (via `wrangler secret put`)

- **HETZNER_API_TOKEN**: Token for Hetzner Cloud API access
- **API_KEY**: Authentication key for main app notifications

### Bindings

- **KV**: KV namespace for minimal state storage
- **DB**: Main D1 database (shared with backend) for data persistence
- **ANALYTICS_ENGINE**: Analytics dataset for statistics and monitoring
- **CLOUD_STATUS_DO**: CloudAvailabilityDO namespace
- **AUCTION_IMPORT_DO**: AuctionImportDO namespace

## API Interaction

### Production (RPC Style)

By default, the worker is accessed via RPC-style interactions from the backend:

- `getStatus()` - RPC method to get current cloud server availability
- Direct Durable Object method calls from parent workers/applications
- No HTTP endpoints exposed in production

### Development Only (HTTP Routes)

HTTP endpoints are **ONLY** enabled when `NODE_ENV=development`:

#### Cloud Availability

- `GET /status` or `GET /cloud/status` - Current cloud server availability
- `POST /cloud/trigger` - Manual cloud status update
- `GET /cloud/debug` - Cloud availability debug info

#### Auction Import

- `POST /auction/import` - Manual auction import trigger
- `GET /auction/debug` - Auction import debug info
- `GET /auction/stats` - Auction database statistics

#### Combined

- `GET /debug` - Combined debug info for both DOs

## Data Storage

### KV Storage (Minimal State)

- **Principle**: Keep as little state as possible in the worker
- **Usage**: Store only essential configuration and temporary state
- **Examples**: Last fetch timestamps, cached status data, configuration overrides

### D1 Database (Data Persistence)

- **Shared Backend DB**: Access to main application's D1 database
- **Usage**: Store auction data, server availability history, persistent records
- **Tables**: `auctions`, `current_auctions`, and other shared backend tables

### Analytics Engine (Statistics Only)

- **Purpose**: Statistical and analytical data only
- **Metrics**: Processing statistics, success/failure rates, performance metrics
- **Benefits**: Built-in analytics capabilities, dashboard integration

## Key Features

### Change Detection

- Tracks changes in cloud server availability
- Monitors auction listing updates (new, removed, price changes)
- Sends notifications to main app via webhook

### Analytics Integration

- **Statistics Only**: Analytics Engine for performance and operational metrics
- **Metrics**: Fetch success/failure rates, processing times, operation counts
- **Monitoring**: Worker performance, API response times, error rates
- **Historical Data**: Stored in main D1 database, not Analytics Engine

### Error Handling

- Comprehensive error logging with DO identifiers
- Graceful degradation on API failures
- Retry logic for transient failures

## Development Notes

### Architecture Principles

- **Single Responsibility**: Each service handles one concern
- **Dependency Injection**: Services accept dependencies in constructors
- **Minimal State**: Keep as little state as possible in workers
- **KV Storage**: Use KV for essential state only
- **Analytics for Stats**: Use Analytics Engine for statistics only, D1 for data persistence
- **Modular Design**: Clear separation between data fetching, processing, and notification

### Testing Strategy

- Unit test individual services in isolation
- Mock external APIs (Hetzner Cloud/Auction)
- Integration test service interactions
- E2E test HTTP endpoints

### Deployment

- Use `npm run deploy` to deploy to Cloudflare
- Migrations defined in wrangler.jsonc for DO schema changes
- Environment-specific configuration via wrangler environments
- Production uses RPC-only interaction (no HTTP endpoints)

## Important Conventions

1. **TypeScript**: Strict mode with proper type definitions
2. **Error Handling**: Always log errors with DO context
3. **Logging**: Include DO ID in all log statements
4. **State Management**: Minimize state, prefer KV for essential data only
5. **Data Persistence**: Use main D1 database for data storage, Analytics Engine for statistics only
6. **HTTP Responses**: Return proper status codes and JSON responses
7. **Scheduling**: Use `ctx.storage.setAlarm()` for periodic execution

## Monitoring

### Debug Access

- **Development**: Use HTTP `/debug` endpoints to inspect DO state
- **Production**: Use RPC methods for status and debugging
- Check alarm scheduling and last execution times
- Verify API token presence, KV storage, and D1 database connectivity

### Analytics

- Monitor fetch success rates via Analytics Engine
- Track processing times and error patterns
- Review data import volumes and trends
