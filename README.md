# Hetzner Radar

Hetzner Radar is a tool that tracks the prices of Hetzner's [Dedicated Server Auction](https://www.hetzner.com/sb/) over time, helping customers identify the best configurations and prices. While Hetzner's auction site allows filtering by certain criteria, it only provides a snapshot at a given moment. Hetzner Radar aims to enhance this by offering advanced filtering and a comprehensive pricing history. Additionally, we track server volumes and other relevant statistics.

## Features

* Track server prices and volumes over time.
* Find all configurations that match your filters.
* View the lowest price seen for a specific configuration.
* Utilize advanced filters such as location, datacenter, CPU, RAM, and drive configuration.

## Architecture

This is a single-tier, client-only architecture, with the website statically built using SvelteKit. DuckDB is used in the background for querying the database.

We fetch the latest auction data from Hetzner once per hour and rebuild the database and website once per day. The raw data is stored in the `data` branch, where we currently maintain three months of history. We may consider purging older data if the branch becomes too large.

The project is currently deployed on GitHub Pages.

## Development

To set up your development environment, you'll need Python 3 for data ingestion and Node.js to run or build the website.

You can also use the provided Nix Flake to set up your environment (though it is somewhat neglected at the moment).

### Preparing the Database

We use Python 3 to create a DuckDB database and ingest the auction data.

```sh
poetry shell
# Add the `data` branch under /data
git worktree add data data
# Build the DuckDB database
python scripts/import.py data web/static/sb.duckdb.wasm
```

### Running the Website

To run the website, simply use the `dev` target. To build a static version, use `build`.

```sh
npm install
npm run dev
```
## Contributions

Contributions are welcome and encouraged! Whether it's fixing a bug, adding a new feature, or optimizing performance, your input can make Hetzner Radar even better. If you have an idea or a patch, feel free to submit a pull request or open an issue.

Before contributing, please ensure that your changes align with the project's goals and architecture. If you're unsure or would like to discuss your ideas, don't hesitate to start a discussion in the issues section.

I'm happy to review and merge any meaningful contributions that improve the project. Thank you for helping to make Hetzner Radar better for everyone!

## Disclaimer

This project was created by a satisfied Hetzner customer and is intended in good faith. The project is designed to be beneficial for all parties involved. If you have any concerns, please reach out.

Please note that this is an independent project and is not officially affiliated with Hetzner. "Hetzner" is a trademark owned by its respective owners. This project does not claim any official endorsement by Hetzner. Use at your own risk.