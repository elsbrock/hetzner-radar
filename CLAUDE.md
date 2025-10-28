# Hetzner Server Radar Project Context

## Project Overview

Hetzner Server Radar is a web application that tracks prices of Hetzner's Dedicated Server Auction over time. It helps customers identify the best configurations and prices by providing advanced filtering, pricing history, and target price alerts.

## Technology Stack

- **Frontend**: SvelteKit 5 with TypeScript
- **Styling**: Tailwind CSS with Flowbite components
- **Database**: DuckDB (client-side) and Cloudflare D1 (backend)
- **Deployment**: Cloudflare Pages with Workers
- **Data Processing**: Python 3 with Poetry for package management
- **Testing**: Playwright for E2E tests, Vitest for unit tests

## Key Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Run svelte-check
npm run lint         # Run prettier and eslint
npm run format       # Format code with prettier
npm run test         # Run tests

# Python/Data Processing
poetry shell         # Enter Python environment
python scripts/import.py data static/sb.duckdb  # Import data
```

## Project Structure

- `/src/routes/` - SvelteKit pages and API routes
- `/src/lib/` - Shared components and utilities
  - `/api/backend/` - Server-side API logic
  - `/api/frontend/` - Client-side API logic
  - `/components/` - Svelte components
  - `/stores/` - Svelte stores
- `/worker/` - Cloudflare Workers (monorepo structure)
- `/migrations/` - D1 database migrations
- `/scripts/` - Python data processing scripts
- `/static/` - Static assets including DuckDB database

## Database Architecture

- **Client-side**: DuckDB WASM for querying auction data
- **Server-side**: Cloudflare D1 for user data, sessions, and alerts
- Data is fetched hourly from Hetzner and stored in the `data` branch

## Key Conventions

1. **TypeScript**: Strict mode enabled, use type annotations
2. **Svelte 5**: Uses runes syntax (`$state`, `$props`, `$derived`)
3. **Imports**: Use `$lib/` alias for internal imports
4. **Icons**: FontAwesome icons via `@fortawesome/svelte-fontawesome`
5. **UI Components**: Flowbite Svelte components
6. **API Routes**: Use `+server.ts` files with proper HTTP method exports
7. **Error Handling**: Use SvelteKit's error handling patterns
8. **Authentication**: Session-based auth with email verification
9. **Commit Checklist**: Always run `npm run check` (and address any errors or warnings) before committing changes

## Important Notes

- The project uses Cloudflare's infrastructure extensively
- DuckDB runs entirely in the browser for data queries
- The `data` branch contains raw auction data (3 months history)
- Independent project, not officially affiliated with Hetzner
- The site must be responsive.
- The changelog page must only be updated whenever a new, noteworthy feature is committed (no layout changes, no minor features, fixes etc.)
