# Generic Webhook Notifications for Price Alerts

Status: implemented (July 2026)

## Intent

Let users receive price-alert notifications via a generic HTTP webhook (JSON
POST to a user-provided URL), in addition to the existing email and Discord
channels. This enables integrations with home automation, custom bots, ntfy,
Slack-compatible relays, etc.

At the same time, introduce **notification jitter**: a small random delay
before an alert's notifications are dispatched. Webhook (and Discord) delivery
is effectively instant; without jitter, users with automated webhook consumers
would reliably snipe every good auction within seconds of the 5-minute import
cycle, crowding out everyone else. A randomized delay of 0–30s per alert
levels the playing field while remaining negligible relative to the 5-minute
import interval.

## Architecture

The feature mirrors the existing Discord channel end to end:

- **D1 schema** (migration `0014_add_generic_webhook_support.sql`)
  - `user.webhook_url TEXT` — the user's webhook endpoint
  - `notification_preferences` JSON gains a `webhook` key (default `false`;
    handled in code, no data migration needed since parsing falls back)
  - `price_alert.webhook_notifications BOOLEAN DEFAULT FALSE` — per-alert flag
  - `price_alert_history.webhook_notifications BOOLEAN DEFAULT FALSE`

- **Worker** (`worker/src/`)
  - `notifications/webhook-channel.ts` — new `WebhookChannel` implementing
    `NotificationChannel`. Sends a JSON POST with a 10s timeout
    (`AbortSignal.timeout`) and a descriptive `User-Agent`.
  - `notifications/alert-notification-service.ts` — refactored orchestration:
    instant channels (Discord, webhook) are attempted independently; email is
    sent when enabled and no instant channel succeeded (fallback), preserving
    existing Discord/email semantics. The duplicated per-channel try/catch is
    collapsed into a single `trySend()` helper.
  - `alert-service.ts` — `MATCH_ALERTS_SQL` selects `user.webhook_url` and
    `pa.webhook_notifications`; history insert stores the flag. Before
    dispatching notifications for a triggered alert, the service sleeps a
    random `0..jitterMs` (default 30 000 ms, configurable via
    `NOTIFICATION_JITTER_MS` env var). Alerts are processed in parallel, so
    total added wall time per import run is bounded by the max jitter.

- **Webhook payload** (versioned, stable contract):

  ```json
  {
    "event": "price_alert.triggered",
    "version": 1,
    "alert": { "id": 1, "name": "…", "targetPrice": 38.0, "vatRate": 19 },
    "trigger": { "price": 35.5, "lowestAuctionPrice": 28.7 },
    "auctions": [{ "id": 123456, "price": 28.7, "seen": "…" }],
    "url": "https://radar.iodev.org/alerts?view=1",
    "triggeredAt": "2026-07-24T…Z"
  }
  ```

  Prices are in EUR incl. VAT (target/trigger) as shown in the UI; auction
  prices are the raw net auction prices, matching the email/Discord content.

- **App backend / UI** (`src/`)
  - `lib/api/backend/user.ts` — `webhook_url` on `User`,
    `updateUserWebhookUrl()`, `validateWebhookUrl()` (https only, rejects
    localhost/private-range IP literals as basic SSRF hygiene).
  - `lib/api/backend/alerts.ts` — `webhook_notifications` on alert types,
    create/update support.
  - Settings page — "Custom Webhook" section mirroring the Discord one: URL
    field, enable toggle in notification preferences, "send test" action.
  - Alerts page — webhook checkbox alongside email/Discord when creating and
    editing alerts (only offered when a webhook URL is configured).

## Decisions & trade-offs

- **Per-user URL + per-alert toggle** (same shape as Discord) rather than
  multiple webhooks per user — keeps schema and UI simple; multiple endpoints
  can be added later with a separate table if demand shows up.
- **No HMAC signing for v1.** The payload contains no secrets and triggers no
  state change on our side; consumers who need authenticity can use a secret
  path/query token in their URL. Signing can be added later behind the same
  `version` field.
- **Jitter applies to the whole notification dispatch of an alert** (all
  channels), not just webhooks — jittering only one channel would simply move
  the sniping to Discord webhooks. Email latency dwarfs the jitter anyway.
- **Jitter lives in `AlertService.processAlert`,** not in individual channels,
  so one alert gets one consistent delay and DB bookkeeping (history insert,
  alert deletion) stays in its current order relative to sending.
- **Fallback semantics preserved:** email remains the safety net — it is sent
  whenever it is enabled and no instant channel delivered successfully.

## Implementation steps

- [x] Spec
- [x] Migration `0014_add_generic_webhook_support.sql`
- [x] Worker: `WebhookChannel`, orchestration refactor, SQL + history changes,
      jitter
- [x] Worker tests (channel, orchestration, jitter bounds)
- [x] Backend API: user + alerts webhook fields, validation
- [x] Settings UI: webhook section + test action
- [x] Alerts UI: per-alert webhook toggle (create + edit)
- [x] `npm run check` / lint / tests green

Out of scope for v1 (possible follow-ups): webhook support for cloud
availability alerts, HMAC payload signing, multiple endpoints per user.
