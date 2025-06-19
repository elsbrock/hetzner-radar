# Server Radar

Server Radar is a tool that tracks the prices of Hetzner's [Dedicated Server
Auction](https://www.hetzner.com/sb/) over time, helping customers identify the
best configurations and prices. While Hetzner's auction site allows filtering by
certain criteria, it only provides a snapshot at a given moment. Server Radar
aims to enhance this by offering advanced filtering, a comprehensive pricing
history and target price alerts. Additionally, we track server volumes and other
relevant statistics.

https://github.com/user-attachments/assets/cb49e923-0315-49aa-a3c2-2dbef2ee0596

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

We fetch the latest auction data from Hetzner once per hour, rebuild the
database, update the website and push new configurations to the backend.
The raw data is stored in the `data` branch, where we currently maintain
three months of history. We may consider purging older data if the branch
becomes too large.

The project is deployed on Cloudflare Pages. Looking ahead, we plan to transition
to a backend-only architecture, eliminating client-side DuckDB and migrating the
data ingestion process from Python scripts to Cloudflare Workers for a fully
integrated solution.

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

For a full development setup with data ingestion:

```sh
cd scripts
poetry shell
# Add the `data` branch under /data
git worktree add ../data data
# Build the DuckDB database
python import.py ../data ../static/sb.duckdb
```

### 2. Setting Up the Cloud Availability Service

The cloud availability service tracks Hetzner Cloud server availability. To run it locally:

1. First, create a `.dev.vars` file in the `worker` directory:

```sh
# create a token via the Hetzner Cloud console
HETZNER_API_TOKEN=your_hetzner_api_token_here
# this is an internal API key used when notifying the backend
API_KEY=your_api_key_here
```

2. Install dependencies for the cloud availability worker:

```sh
cd worker
npm install
```

3. Start the Cloud Availability worker:

```sh
npx wrangler dev
```

The worker will start on port 8787 by default. Keep this terminal window open.

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

The application will be available at http://localhost:5123. If the Cloud Availability worker is running, the backend can automatically interact with it.

### Troubleshooting

- If you see session-related errors, these are expected in development mode and won't affect core functionality.
- If the cloud status feature shows errors, ensure both Cloud Availability worker is running and was started before the backend.
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
