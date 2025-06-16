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

This is a client- and backend architecture, with the website statically
built using SvelteKit. DuckDB is used in the background for querying the
database on the client.

In addition, we use Cloudflare Workers to for session management, storing
alerts and sending email notifications.

We fetch the latest auction data from Hetzner once per hour, rebuild the
database, update the website and push new configurations to the backend.
The raw data is stored in the `data` branch, where we currently maintain
three months of history. We may consider purging older data if the branch
becomes too large.

The project is deployed on Cloudflare Pages.

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
poetry shell
# Add the `data` branch under /data
git worktree add data data
# Build the DuckDB database
python scripts/import.py data static/sb.duckdb
```

### 2. Setting Up the Cloud Availability Service

The cloud availability service tracks Hetzner Cloud server availability. To run it locally:

1. First, create a `.dev.vars` file in the `workers/cloud-availability` directory:

```sh
HETZNER_API_TOKEN=your_hetzner_api_token_here
API_KEY=your_api_key_here
```

2. Install dependencies for the cloud availability worker:

```sh
cd workers/cloud-availability
npm install
```

3. Start the cloud availability worker:

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

2. Build the application:

```sh
npm run build
```

3. Start the application with Wrangler:

```sh
npx wrangler dev .svelte-kit/cloudflare/_worker.js
```

The application will be available at http://localhost:8787. The cloud status feature will be available at http://localhost:8787/cloud-status.

### Development Tips

1. **Working on Frontend Only**: If you only need to work on the frontend and don't need the cloud status feature, you can use:
   ```sh
   npm run dev
   ```
   This will start the development server at http://localhost:5173.

2. **Database Updates**: The database is updated hourly in production. For development, you can manually trigger an update:
   ```sh
   python scripts/import.py data static/sb.duckdb
   ```

3. **Troubleshooting**:
   - If you see session-related errors, these are expected in development mode and won't affect core functionality.
   - If the cloud status feature shows errors, ensure both the cloud availability worker and main application are running.
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

## Disclaimer

This project was created by a satisfied Hetzner customer and is intended in good
faith. The project is designed to be beneficial for all parties involved. If you
have any concerns, please reach out.

Please note that this is an independent project and is not officially affiliated
with Hetzner. "Hetzner" is a trademark owned by its respective owners. This
project does not claim any official endorsement by Hetzner, nor does it
guarantee correctness of the data. Use at your own risk.
