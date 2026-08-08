# Cloud Status Polling: Caching, Discoverability, and Limits

Status: proposed (August 2026)

## Intent

`/cloud-status` and its data endpoints are polled continuously by third-party
stock-watching bots. Server Radar already offers a push alternative — cloud
alerts with email, Discord, and generic webhook channels — but nothing in the
product tells a scraper author that it exists, and nothing makes polling cheap
for us or bounded for them.

This spec covers three changes, in priority order:

1. Make polling cheap (edge caching on the hot endpoints).
2. Make the push alternative discoverable from the endpoints being polled.
3. Add a rate-limit backstop against genuine abuse.

It is explicitly *not* about blocking scrapers. They are the target audience.

## What the traffic actually looks like

Measured from the Cloudflare GraphQL Analytics API, zone `iodev.org`,
1–8 August 2026. "Real" excludes Cloudflare-internal probes (see below).

Real client requests per day, and 5xx actually served to real clients:

| Day | Requests | 5xx |
|---|---|---|
| Aug 1 | 43.6k | 0 |
| Aug 2 | 48.5k | 2 |
| Aug 3 | 94.8k | 0 |
| Aug 4 | 114.4k | 4 |
| Aug 5 | 46.2k | 1 |

The Aug 3–4 bump was **not** an attack. It was a single Vodafone DE residential
IP (`90.187.237.249`, Ubuntu Firefox 152, HTTP/3) running a hard-refresh loop
during working hours on Mon and Tue, with a gap over lunch on Monday. It made
82,468 requests, but **97% were Cloudflare cache hits** on immutable JS chunks;
only ~2,500 reached the Worker. Cost to us: negligible.

The traffic that actually costs us is the steady polling population, all of it
on uncached endpoints (counts over Aug 3–4):

| Client | Requests | Rate | Target |
|---|---|---|---|
| `74.248.96.183` (Azure PL, spoofed Chrome UA) | 16,944 | ~6/min | `/cloud-status/__data.json` |
| `95.216.146.177` (Hetzner FI, `MSIE 6.0` UA) | 14,135 | ~5/min | `/cloud-status` |
| `79.101.44.157` (RS, `axios/0.25.0`) | 3,985 | ~1.4/min | `/` |
| `Penny-CX33-Stock-Watcher/1.0` | 577 | ~0.2/min | `/cloud-status/__data.json` |
| `Hermes-CX43-availability-watch/2.0` | 567 | ~0.2/min | `/cloud-status/__data.json` |
| `hermes-cx33-watcher/1.0` | 179 | — | `/cloud-status` |

Total origin-hitting load: **~22k requests/day**.

**The important nuance:** no single client is hammering us. The worst is ~6
requests/minute — roughly one poll per 10s against data that refreshes once a
minute. Wasteful, but not abusive, and *below* what a human clicking around a
SvelteKit app can generate in bursts. The volume comes from there being many
such clients against zero caching, not from any one being aggressive.

This is why the primary fix is caching, not rate limiting. A limit tight enough
to stop a 6/min poller would produce false positives on real users.

### The 504s in the dashboard are an artifact — ignore them

Cloudflare analytics reports 15–23k 504s per day, every day, ~20% of requests.
They are not real. **Every one has `clientRequestHTTPProtocol=UNK` and
`clientSSLProtocol=none`** — there is no client TLS connection. They are
Cloudflare's Early Hints probes (`early_hints = "on"`, infra repo
`terraform/cloudflare/settings.tf:20`), which inherit the triggering request's
User-Agent and so pair 1:1 with real 200s per client.

Corroborated three ways: `workersInvocationsAdaptive` shows **0 errors** for
`server-radar` with p99 duration 0.27s across the spike; real-client 5xx is 0–4
per day; and 30/30 live probes returned 200.

The cost of leaving this on is that a permanent phantom 20% error rate makes a
real outage invisible in the dashboard. See step 3.4.

## Current state

| Endpoint | Cache-Control | Backed by |
|---|---|---|
| `/cloud-status` | *(none)* | SSR + `RADAR_WORKER.getStatus()` DO RPC |
| `/cloud-status/__data.json` | `private, no-store` | same |
| `/api/cloud-status/history` | *(none)* | `RADAR_WORKER` DO RPC |
| `/_app/immutable/*` | immutable | Workers Static Assets (already cached) |

`private, no-store` on `__data.json` is SvelteKit's default because the page
load returns `locals.user`. That single field is what makes the entire cloud
status payload uncacheable.

`robots.txt` is `Allow: /` with no crawl-delay and no mention of the API or
alerts. The on-page alert CTA advertises "Free email and Discord notifications"
and does not mention webhooks at all.

## Design

### 1. Make polling cheap

Worker-generated responses are **not** automatically stored in Cloudflare's edge
cache — the Worker runs ahead of it, so `s-maxage` alone changes nothing for us
(it only helps well-behaved clients self-throttle, which is still worth having).
Caching has to be explicit.

Two options:

**A. Cache API (`caches.default`) around the status payload.** ~30 lines, no
schema change, per-colo TTL of 60s. Collapses ~22k/day origin hits to roughly
one per colo per minute.

**B. KV snapshot, mirroring the auction snapshot.** `worker/src/auction-snapshot.ts`
already builds a versioned snapshot that `auction-service.ts` writes to KV after
each import, which `/mcp` reads via `src/lib/server/mcp/snapshot.ts` — so MCP
traffic never touches D1. The cloud availability DO could publish the same way.

**Recommendation: A now, B if cloud status should also be exposed over `/mcp`.**
Option A solves the load problem today. Option B is the better long-term shape
but is a larger change and only pays off if there's a second consumer.

Prerequisite either way: **make the cloud-status payload anonymous.** `data.user`
is used at exactly one place, `+page.svelte:1328`, to choose between a "Create
Availability Alert" button and a "Sign In to Create Alerts" button. Source that
from the layout's `session` (already loaded in `+layout.server.ts`) or render it
client-side, then drop `user` from `+page.server.ts`'s return and the
`private, no-store` disappears.

### 2. Make the push alternative discoverable

A scraper author currently has no way to learn that webhooks exist. Fix that at
the point of contact:

- Response headers on all three polled endpoints:
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
  - `Link: <https://radar.iodev.org/guide#cloud-alerts>; rel="help"`
  - `X-Poll-Policy: refresh=60s; push=https://radar.iodev.org/guide#cloud-alerts`
- `robots.txt`: add a comment block naming the alert/webhook path and a
  `Crawl-delay: 60`.
- Fix the on-page CTA copy to mention webhooks alongside email and Discord.
- A short "Polling and automation" section in `/guide`: state the once-a-minute
  refresh, ask for ≤1 req/min, and link cloud alerts + the `cloud_alert.triggered`
  webhook envelope (documented in `webhook-alerts-2026-07.md`).

Requiring an account for cloud alerts is the friction that pushes people to
scrape anonymously in the first place. Worth considering an unauthenticated
webhook registration later; out of scope here.

### 3. Rate limiting

**Caching does not bound request count.** A Cache API hit still invokes the
Worker and still bills a request — only Workers Static Assets bypass the Worker,
and `/cloud-status` is dynamic. Caching cuts DO RPC and D1 work; it does nothing
about invocation volume. Only a limit evaluated at the edge, before the Worker
runs, does that.

This decides the limiter: **Cloudflare `http_ratelimit` ruleset, not the Workers
`RATE_LIMIT` binding.** The binding runs inside the Worker, so it would reject
requests we have already paid for. The zone currently has no `http_ratelimit`
ruleset (confirmed via API: *"could not find entrypoint ruleset in the
http_ratelimit phase"*), so this is a new entrypoint — Pro-plan rule allowance
still needs verifying (step 3.3), and if Pro turns out not to support it, the
binding is a degraded fallback that fixes politeness but not cost.

Thresholds are scoped per path group, because the two have different human
profiles:

| Paths | Limit | Rationale |
|---|---|---|
| `/cloud-status`, `/cloud-status/__data.json` | 10/min per IP | Page loads. A human reloading a status page >10x/min is not a real pattern. |
| `/api/cloud-status/*` | 30/min per IP | Interactive — clicking cells fires history requests in bursts, and `+page.svelte:1361` calls `invalidateAll()`. |

On breach: `429` with `Retry-After: 60` and a JSON body pointing at cloud alerts
and the webhook envelope. **The 429 body is the highest-signal place in the whole
design to advertise the push path** — headers get ignored, but a broken
integration gets read and fixed, and only the impolite ever see it.

**Staged rollout.** At 10/min the current pollers (~6/min) still pass. That is
deliberate: ship discoverability and the limit together, give the existing
watchers a grace period to find the webhook path, then tighten the page-load
group to ~2/min once the docs have been live long enough to be findable. Landing
at 2/min on day one would 429 people who have no idea an alternative exists,
which is the hostile version of this change.

A 60s window cannot distinguish a human burst from a sustained poller, which is
why the thresholds sit above the current offenders rather than at the ~5/min it
would take to catch them immediately. Longer averaging windows would separate
the two cleanly but are not available on Pro.

## Decisions & trade-offs

- **Don't block ASNs or bot UAs.** The Hetzner/Azure pollers are the product's
  audience. Blocking pushes them to residential proxies and breaks legitimate
  API users; caching removes the cost without the collateral damage.
- **Don't require auth for reads.** The public cloud-status data is the product's
  reason to exist and its main SEO surface.
- **60s TTL** matches the stated refresh rate ("refreshed once a minute"), so it
  adds no staleness a user could observe.
- **Cache API over KV** for now: per-colo rather than global, but no new write
  path in the DO and no snapshot versioning to maintain.
- **Limit at the edge, not in the Worker.** Cache API hits still bill an
  invocation, so an in-Worker limiter bounds politeness but not cost.
- **Thresholds start above the current offenders, then tighten.** Not because
  6/min is acceptable — it is 6x oversampling against once-a-minute data — but
  because 429-ing people before the alternative is documented is hostile. The
  docs and the limit ship together; the tightening follows.
- **Caching is still worth doing even with limits in place.** It protects the DO
  and D1 path, cuts latency, and keeps the service healthy if the watcher
  population grows.

## Implementation steps

**hetzner-radar**

- [ ] 1.1 Move the `data.user` CTA gate at `+page.svelte:1328` to the layout
      `session` or client-side rendering
- [ ] 1.2 Drop `user` from `src/routes/cloud-status/+page.server.ts`'s return;
      confirm `__data.json` loses `private, no-store`
- [ ] 1.3 Add Cache API wrapping (60s) for the cloud-status payload
- [ ] 1.4 Same for `/api/cloud-status/history` — keyed on the query params
- [ ] 2.1 Add `Cache-Control`, `Link rel=help`, `X-Poll-Policy` headers to the
      three polled endpoints
- [ ] 2.2 `static/robots.txt`: crawl-delay + pointer to the alerts docs
- [ ] 2.3 Fix CTA copy at `+page.svelte:~1345` to mention webhooks
- [ ] 2.4 Add a "Polling and automation" section to `/guide`
- [ ] 3.1 Implement the 429 response body (cloud alerts + webhook envelope
      pointer, `Retry-After: 60`) for the rate-limited paths

**infra**

- [ ] 3.2 Add an `http_ratelimit` ruleset to `terraform/cloudflare/rules.tf`:
      10/min on `/cloud-status`+`__data.json`, 30/min on `/api/cloud-status/*`
- [ ] 3.3 Verify Pro-plan rate-limiting rule allowance before 3.2 — if
      unsupported, fall back to the `RATE_LIMIT` binding and accept that it
      bounds politeness but not invocation cost
- [ ] 3.4 Set `early_hints = "off"` in `terraform/cloudflare/settings.tf:20` —
      the Worker already emits its own `Link` preload headers, and the phantom
      504s make the dashboard unreadable

**Verification**

- [ ] 4.1 Re-run the analytics query a week after deploy; confirm origin-hitting
      requests drop from ~22k/day and that real-client 5xx stays at ~0
- [ ] 4.4 Check 429 counts by client before tightening to 2/min — if the known
      watchers have migrated to webhooks, tighten; if they have not, find out why
      before making it harder for them
- [ ] 4.2 Confirm `cf-cache-status` / Cache API hit rate on the status endpoints
- [ ] 4.3 Confirm no authenticated user is ever served a cached anonymous payload

## Open questions

- Is a 60s TTL acceptable for the auction/stock-sniping use case, or do the
  watchers need finer granularity than the data itself has?
- Should cloud status be exposed over `/mcp` (which would argue for option B)?
- Is unauthenticated webhook registration worth doing to remove the sign-up
  friction that drives anonymous scraping?
