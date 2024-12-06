# Hetzner Radar

Hetzner Radar is a tool that tracks the prices of Hetzner's [Dedicated Server
Auction](https://www.hetzner.com/sb/) over time, helping customers identify the
best configurations and prices. While Hetzner's auction site allows filtering by
certain criteria, it only provides a snapshot at a given moment. Hetzner Radar
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

* Track server prices and volumes over time.
* Find all configurations that match your filter criteria.
* View the lowest price seen for a specific configuration.
* *New*: Get notified when your target price is met.

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

To set up your development environment, you'll need Python 3 for data ingestion
and Node.js to run or build the website.

You can also use the provided Nix Flake to set up your environment (though it is
somewhat neglected at the moment).

### Preparing the Database

This step is optional if you just want to work on the frontend. You can simply
download the latest snapshot from the website:

```
wget https://static.radar.iodev.org/sb.duckdb -O static/sb.duckdb
```

If you just want to inspect or play with the dataset, you can do so by running.

```
duckdb -cmd "attach 'https://static.radar.iodev.org/sb.duckdb' (read_only); use sb;"
```

:
Inspect the schema using the `.schema` pragma.

We use Python 3 to create a DuckDB database and ingest the auction data.

```sh
poetry shell
# Add the `data` branch under /data
git worktree add data data
# Build the DuckDB database
python scripts/import.py data static/sb.duckdb
```

### Running the Website

To run the website, simply use the `dev` target. To build a static version, use
`build`.

```sh
npm install
npm run dev
```
## Contributions

Contributions are welcome and encouraged! Whether it's fixing a bug, adding a
new feature, or optimizing performance, your input can make Hetzner Radar even
better. If you have an idea or a patch, feel free to submit a pull request or
open an issue.

Before contributing, please ensure that your changes align with the project's
goals and architecture. If you're unsure or would like to discuss your ideas,
don't hesitate to start a discussion in the issues section.

I'm happy to review and merge any meaningful contributions that improve the
project. Thank you for helping to make Hetzner Radar better for everyone!

## Disclaimer

This project was created by a satisfied Hetzner customer and is intended in good
faith. The project is designed to be beneficial for all parties involved. If you
have any concerns, please reach out.

Please note that this is an independent project and is not officially affiliated
with Hetzner. "Hetzner" is a trademark owned by its respective owners. This
project does not claim any official endorsement by Hetzner, nor does it
T:guarantee correctness of the data. Use at your own risk.
