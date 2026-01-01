# Server Radar

Server Radar is a tool that tracks the prices of Hetzner's [Dedicated Server
Auction](https://www.hetzner.com/sb/) over time, helping customers identify the
best configurations and prices. While Hetzner's auction site allows filtering by
certain criteria, it only provides a snapshot at a given moment. Server Radar
aims to enhance this by offering advanced filtering, a comprehensive pricing
history and target price alerts. Additionally, we track server volumes and other
relevant statistics.

<p align="center">
  <img width="250" src="https://github.com/user-attachments/assets/e32aaa07-a651-4dc2-8df3-0d5b8ee4a8b8"/>
  <img width="250" src="https://github.com/user-attachments/assets/47d5a2f7-c924-49cc-b271-c58d5a28a921"/>
  <img width="250" src="https://github.com/user-attachments/assets/e1de28a0-7e84-48c1-8238-4869b7163c0d"/>
  <img width="250" src="https://github.com/user-attachments/assets/3e3ce873-4356-4e27-a80b-431d81dbb1c9"/>
  <img width="250" src="https://github.com/user-attachments/assets/aa91e605-1c09-4050-8dba-d2fd28b7bf1b"/>
  <img width="250" src="https://github.com/user-attachments/assets/1ec0d4b3-4f1e-44f9-8b79-bf45eccc4ddf"/>
</p>

<br/>
<br/>

> [!NOTE]
> This is an independent project and is not officially affiliated with Hetzner.
> "Hetzner" is a trademark owned by its respective owners. This project does
> not claim any official endorsement by Hetzner, nor does it guarantee
> correctness of the data. Use at your own risk.

## Features

- Track server prices and volumes over time.
- Find all configurations that match your filter criteria.
- View the lowest price seen for a specific configuration.
- _New_: Get notified when your target price is met.

## Architecture

Server Radar started as a purely static, client-side application where users could
browse and filter server data entirely in their browser using DuckDB WASM. When we
introduced the alerts feature, we needed persistent storage and notification
capabilities, which led to the current hybrid architecture.

Today, the project uses both client- and backend components, with the website
statically built using SvelteKit. DuckDB is still used for querying the database
on the client, while Cloudflare Workers handle session management, storing alerts
and sending email notifications (using D1 for backend storage).

Auction data is fetched from Hetzner every 5 minutes via two parallel pipelines:
- **Cloudflare Worker**: Imports directly into D1 for real-time alert processing
- **GitHub Actions**: Incrementally updates the DuckDB database stored in R2 for client-side analytics

The DuckDB database is updated incrementally - each run fetches the current snapshot
from Hetzner, merges it with existing data (keeping one record per auction per day),
and automatically purges data older than 90 days.

The project is deployed on Cloudflare Pages. Looking ahead, we plan to transition
to a backend-only architecture, eliminating client-side DuckDB entirely.

### Auction Data Storage Strategy

As part of our transition to a backend-only architecture, we're implementing a dual-table storage strategy for auction data in the backend (Cloudflare D1):

- **`auctions` table**: Stores historical auction data with intelligent deduplication - only creates new entries when server prices or specifications change. This preserves a complete pricing history while eliminating redundant data.

- **`current_auctions` table**: Maintains the current state of all active auctions (one row per auction). This table is continuously updated with the latest auction data, regardless of whether prices have changed.

This backend storage approach significantly reduces D1 database reads by:

- **Alert matching**: Queries run against the smaller `current_auctions` table (~100K records) instead of the full historical dataset (~1M+ records)
- **Deduplication**: Eliminates storage of unchanged auction data, reducing both storage costs and query complexity
- **Optimized indexing**: The `current_auctions` table has specialized indices for efficient alert matching

Auction data is imported every 5 minutes from Hetzner's API directly by our Cloudflare Worker (AuctionImportDO), with only price changes and new listings being stored in the historical `auctions` table, while all current states are refreshed in `current_auctions`. This backend storage complements the existing client-side DuckDB approach during the architectural transition.

### Alert Processing Architecture

The alert system has been redesigned with a worker-based architecture for improved reliability and performance:

**Alert Processing Flow:**

1. **Auction Import**: The AuctionImportDO worker fetches new auction data every 5 minutes
2. **Change Detection**: Only processes alerts when auction data changes (new listings or price changes)
3. **Alert Matching**: Complex SQL-based matching against user-defined filter criteria
4. **Notification Dispatch**: Multi-channel notifications with fallback logic

**Notification Channels:**

- **Email**: Primary notification method using ForwardEmail API
- **Discord**: Optional webhook-based notifications with rich embeds
- **Extensible Design**: Channel-based architecture allows easy addition of new notification methods (SMS, Slack, etc.)

**Key Features:**

- **Fallback Logic**: If Discord notifications fail, falls back to email
- **Atomic Processing**: Alert deletion and history storage happen in database transactions
- **Performance Optimized**: Parallel processing of multiple alerts
- **Comprehensive Logging**: Full audit trail for debugging and monitoring

The legacy push endpoint (`/api/push`) is deprecated but maintained temporarily for backward compatibility. All new alert processing happens automatically in the worker during auction imports.

### Cloud Alert Processing Architecture

Cloud availability alerts use the same worker-based architecture for consistent performance and reliability:

**Cloud Alert Processing Flow:**

1. **Status Monitoring**: CloudAvailabilityDO checks Hetzner Cloud API every 60 seconds
2. **Change Detection**: Compares current availability with previous state
3. **Alert Matching**: Matches availability changes against user-defined cloud alerts
4. **Notification Dispatch**: Multi-channel notifications with the same fallback logic

**Integration Benefits:**

- **Unified Architecture**: Both auction and cloud alerts use same notification channels
- **Real-time Processing**: Cloud alerts process immediately when availability changes
- **Shared Infrastructure**: Email and Discord channels reused across alert types
- **Consistent Behavior**: Same fallback logic and error handling patterns

The legacy notify endpoint (`/api/notify`) is deprecated but maintained temporarily for backward compatibility. All new cloud alert processing happens automatically in the worker during cloud status updates.

## Development

To set up your development environment, you'll need:

- Python 3 for data ingestion
- Node.js 18+ for running the website
- Wrangler CLI for running Cloudflare Workers locally

### 1. Preparing the Database

This step is optional if you just want to work on the frontend. You can simply
download the latest snapshot from the website:

```sh
wget https://static.radar.iodev.org/sb.duckdb -O static/sb.duckdb
```

If you just want to inspect or play with the dataset, you can do so by running:

```sh
duckdb -cmd "attach 'https://static.radar.iodev.org/sb.duckdb' (read_only); use sb;"
```

Inspect the schema using the `.schema` pragma.

To manually update the database with the latest data:

```sh
cd scripts
poetry install
poetry run python update_incremental.py ../static/sb.duckdb
```

### 2. Setting Up the Worker

The worker handles multiple functions including auction data fetching, cloud availability tracking, and alert notifications. To run it locally:

1. First, create a `.dev.vars` file in the `worker` directory:

```sh
# create a token via the Hetzner Cloud console
HETZNER_API_TOKEN=your_hetzner_api_token_here
# this is an internal API key used when notifying the backend
API_KEY=your_api_key_here
# API key for ForwardEmail service (for alert notifications)
FORWARDEMAIL_API_KEY=your_forwardemail_api_key_here
```

2. Install dependencies for the worker:

```sh
cd worker
npm install
```

3. Start the worker:

```sh
npx wrangler dev
```

The worker will start on port 8787 by default. Keep this terminal window open.

For local development, the worker exposes HTTP debug routes at http://localhost:8787. Visit any invalid endpoint to see available routes and usage examples.

### 3. Running the Main Application

1. Install dependencies:

```sh
# In the project root
npm install
```

2. Start the application

```sh
npm run dev
```

The application will be available at http://localhost:5123. If the worker is running, the backend can automatically interact with it for cloud availability tracking and auction processing.

### Troubleshooting

- If you see session-related errors, these are expected in development mode and won't affect core functionality.
- If the cloud status feature shows errors, ensure the worker is running and was started before the backend.
- Check the browser console and terminal output for detailed error messages.

## Contributions

Contributions are welcome and encouraged! Whether it's fixing a bug, adding a
new feature, or optimizing performance, your input can make Server Radar even
better. If you have an idea or a patch, feel free to submit a pull request or
open an issue.

Before contributing, please ensure that your changes align with the project's
goals and architecture. If you're unsure or would like to discuss your ideas,
don't hesitate to start a discussion in the issues section.

I'm happy to review and merge any meaningful contributions that improve the
project. Thank you for helping to make Server Radar better for everyone!

## Behind the Scenes

The initial version of Server Radar was entirely hand-crafted, serving as a learning
project for SvelteKit and DuckDB. As the project evolved, we began incorporating
AI tools to accelerate development - first using Roo, and now primarily Claude Code.
Some features and website content (like testimonials) were added just for fun and are
entirely fictional - don't take everything too seriously! This blend of manual
craftsmanship, AI assistance, and creative liberties has made the project what it is today.

## Disclaimer

This project was created by a satisfied Hetzner customer and is intended in good
faith. The project is designed to be beneficial for all parties involved. If you
have any concerns, please reach out.

Please note that this is an independent project and is not officially affiliated
with Hetzner. "Hetzner" is a trademark owned by its respective owners. This
project does not claim any official endorsement by Hetzner, nor does it
guarantee correctness of the data. Use at your own risk.
