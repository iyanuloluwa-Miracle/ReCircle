# Recykle AI — Phase 9

A Lagos-focused recycling coordination hackathon prototype built with Nuxt 4,
strict TypeScript and Tailwind CSS 4. Phase 9 adds Smart Collection Batch on the
operator dashboard: deterministic geographic grouping of nearby pickups into
suggested collection sequences (straight-line heuristics, not road routing).

## Local setup

Use Node.js 24 LTS and npm.

1. Run `npm install` (use `npm.cmd` in PowerShell if script execution is disabled).
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB Atlas URI. Configure an Atlas database user and
   network access for your machine. Never paste credentials into commits or logs.
4. Generate `SESSION_SECRET` locally:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Run `npm run dev` and open http://localhost:3000.

The scanner needs `BYTESHIP_API_KEY`; analysis needs `OPENROUTER_API_KEY` and a
vision model in `OPENROUTER_MODEL` that supports strict structured output.
Payment keys may remain empty.
Set `SESSION_SECRET` to at least 32 random characters before using authentication.

## Commands

- `npm run dev`: development server
- `npm run lint`: ESLint
- `npm run typecheck`: strict Nuxt/Vue TypeScript checks
- `npm test`: password, model, classification, matching, lifecycle and dashboard helper checks
- `npm run build`: production build
- `npm run seed`: insert labelled demo data and verify MongoDB indexes
- `npm run test:auth`: HTTP auth checks against a running dev server on port 3001
- `npm run test:upload`: live Byteship upload and draft check against port 3001
- `npm run test:analysis`: live upload, OpenRouter classification, auth, cache and correction check against port 3001
- `npm run preview`: local production preview

## Structure

Nuxt 4 frontend directories live under `app/`; do not add duplicate root pages or components.

```text
app/
  pages/          Landing, accounts, role pages, scanner, analysis, valuation and requests
  layouts/        Public and dashboard shells
  components/     Brand, navigation, Button, Card, Badge, Modal,
                  EmptyState, LoadingSkeleton, StatCard, StatusTimeline, RequestCard,
                  DashboardMetrics, IncomingRequestCard, BreakdownList, CapacityMeter
  composables/    Auth, scanner upload, pickup location, chart and health state
  middleware/     Role-aware navigation guards
  assets/css/     Tailwind entry, design tokens and responsive styles
server/
  api/            HTTP endpoints
  middleware/     Response headers
  models/         Mongoose operational models and GeoJSON validation
  services/       Password hashing, classification, matching, pickup requests and clients
  utils/          Configuration, database, sessions and validation
scripts/           Demo seed and live HTTP verification
types/            Shared contracts; never put secrets here
utils/            Pure formatting, classification, matching and lifecycle utilities
tests/            Password, model, classification, matching and lifecycle tests
```

Frontend components own presentation only. Request bodies use Zod through
`readValidatedJson`. Protected endpoints use server authorization; client
middleware is not an authorization boundary.

## Waste scanner and uploads

Consumers can open `/scan` from their workspace. The page accepts JPEG, PNG, and
WEBP images up to 5 MB, including a phone camera input where supported. Device
location requires browser permission; manual coordinates are available if it fails.
Seeded consumer accounts start with an explicitly labelled demo Lagos pickup point.
No location is inferred from an image.

`POST /api/upload-token` asks Byteship for a public, 15-minute token scoped to
`waste-images/<user id>` with a 5 MB upload limit. The project API key stays on the
server. Byteship's token API does not provide a MIME allowlist, so the browser
checks type and file signature before upload, and `POST /api/waste-items/draft`
checks provider metadata and image bytes before saving. A retry after a completed
upload reuses the same storage path and draft. The draft contains an image URL,
pickup location and source, but no guessed material, weight, or value.

## AI material analysis

`POST /api/analyze-waste` accepts a WasteItem ID. The owner or a waste operator
can request analysis; other consumers get 404 and other roles get 403. A short
MongoDB lock prevents concurrent calls on the same draft. Successful results are
cached on the item and reused on later requests. OpenRouter receives only the
verified public image URL and a conservative classifier prompt. Its response must
match a strict JSON schema and pass server Zod validation before the item advances
to `analyzed`. Provider failures leave the draft available for retry.
`UNKNOWN` and `MIXED` results are capped below the confirmation threshold even if
the model reports higher confidence.

The review screen displays the photo, material, recyclability, confidence, safety
warning, and preparation instructions. Below 65% AI confidence, the consumer must
confirm or correct the material before saving weight. Manual corrections and weight
are validated on `PATCH /api/waste-items/:id/analysis`; neither is inferred by AI.
Changing material clears potentially misleading AI preparation instructions.
Historical lowercase demo material codes remain readable; new classifier output uses
the uppercase contract.

## Waste valuation and recycler matching

`POST /api/match-recycler` accepts `{ wasteItemId, weightKg }` and never calls an LLM.
The server loads the classified WasteItem, requires `weightKg > 0`, then uses MongoDB
`$geoNear` on the recycler `2dsphere` index. Eligible recyclers must accept the
material (including `ALUMINUM` ↔ `aluminium` aliases), be `available`, have remaining
daily capacity for the load, sit within their own `serviceRadiusKm`, and publish a
pricing rule for that material.

Each candidate is scored out of 100 with fixed weights: distance 40, offered price 35,
and remaining capacity 25, normalized across the eligible pool. The response returns
the top three matches plus the recommended recycler, each with human-readable reasons
such as distance, NGN/kg, accepted material, and capacity percentage. The WasteItem
stores `weightKg`, `estimatedValueMin`, `estimatedValueMax`, and advances to `matched`
when at least one recycler qualifies.

The analysis review offers **Get valuation & matches** after weight is saved. The
valuation screen at `/scan/:id/match` shows the NGN range, best match, match score,
why-selected reasons, and a **Compare 3 recyclers** toggle. Matching decisions stay
deterministic server logic; MongoDB only stores inputs and results.

## Pickup request workflow

`POST /api/create-request` accepts `{ wasteItemId, recyclerId }` for consumers. The
server re-checks recycler eligibility, creates a `pending` Request (or reopens a
cancelled/rejected one for the same waste item), and sets the WasteItem to
`pickup_requested`. Multi-document writes run inside a MongoDB transaction.

`GET /api/requests` is role-scoped: consumers see their requests, recyclers see
jobs assigned to their profile, and waste operators see all requests for monitoring.
`PATCH /api/requests/:id/status` enforces a strict lifecycle:

`pending → accepted → picked_up → completed`, with `pending → rejected|cancelled`.
Illegal moves such as `completed → pending` or `rejected → picked_up` return 409.
Consumers may only cancel pending requests. Recyclers may accept, reject, mark
picked up, and complete. Operators view only.

Accepting a request reserves daily capacity (`currentLoadKg += weightKg`) with a
conditional update. Completion marks the WasteItem `completed` and creates a
completed mock `Transaction` for the expected payout. Responses include audit
timestamps (`acceptedAt`, `pickedUpAt`, `completedAt`, `rejectedAt`, `cancelledAt`)
and a reusable status timeline (Analyzed → Recycler matched → Pickup requested →
Recycler accepted → Collected → Payment).

Role dashboards render request cards with that timeline and the allowed actions.

Run `npm run test:upload` against a dev server on port 3001 to verify a scoped token,
public upload, draft creation, retry, and analysis handoff. The check attempts to
remove its temporary demo image and draft; cleanup needs a Byteship key with delete
permission. See [Byteship browser uploads](https://byteship.dev/docs/browser-uploads)
and [API reference](https://byteship.dev/docs/api-reference).

## Multi-role dashboards

`GET /api/dashboard/user`, `GET /api/dashboard/recycler`, and
`GET /api/dashboard/operator` return session-scoped metrics aggregated from
WasteItem, Request, Transaction, and Recycler collections. Dashboard numbers are
never hard-coded in the UI.

- **Consumer:** waste diverted (kg), total earned (NGN), active pickups, recycling
  streak, plus active pickup, recent scans, wallet activity, and tips. Primary CTA
  is **Scan waste**.
- **Recycler:** available supply, jobs today, potential purchase value, completed
  collections, incoming matched waste cards (photo, material, weight, distance,
  purchase price, pickup area, Accept/Reject), accepted pickups, material breakdown,
  and current capacity.
- **Operator:** active pickups, kg awaiting collection, completed today, total
  payouts, status distribution chart, recent activity, recycler utilization, and
  the live collection queue.

All three layouts share the same metric cards, section shells, empty states, and
loading skeletons, and are tuned for 375px mobile, tablet, and desktop widths.


## Smart Collection Batch

`GET /api/optimize-pickups?zoneId=` is an operator-only, read-only planner. It loads
pending and accepted requests, filters by a Lagos zone, clusters nearby pickups with
a deterministic radius heuristic, then orders each cluster with nearest-neighbour.
The UI labels this a **Suggested collection sequence** and compares naive vs suggested
straight-line distance. An SVG marker map is included; no paid routing API is used.
This endpoint never mutates WasteItem, Request, or capacity state, so the scan → match
→ request flow stays unchanged.

## Why MongoDB

Waste classification can vary by material, packaging, and disposal guidance, so
document records keep those fields together without forcing every future item into
the same rigid table shape. GeoJSON points and `2dsphere` indexes let the server find
recyclers near a pickup location. Indexed availability, load, and request status
support operational coordination. Aggregation pipelines can group completed requests
and mock rewards by material, recycler, or date for later analytics. Prices and
matching decisions remain deterministic server logic; MongoDB stores their inputs
and results.

## Phase 2 demo data

Run `npm run seed` after setting `MONGODB_URI` and `DEMO_SEED_PASSWORD` (at least 12
characters) in your local `.env` or process environment. The URI must name a
non-system database. The seed is repeatable and inserts only documents with fixed
demo IDs and `isDemo: true`; existing seeded documents are left alone. It creates
one consumer, one waste operator, four fictional Lagos recycler businesses, and
four historical completed requests with mock transactions. **All recycler prices
are invented DEMO values, not real market quotes.** Never use this data for actual
payouts or collection decisions. The script creates and verifies every declared
index without dropping existing indexes.

Prices, estimates, and payouts are stored as numeric NGN amounts. The demo uses
whole naira. Future payment logic should define rounding and precision rules before
any real transaction is processed.

## Accounts and role access

`POST /api/auth/register` creates consumer accounts only. `POST /api/auth/login`
checks a salted scrypt password hash. `POST /api/auth/logout` clears the encrypted
HttpOnly session cookie, and `GET /api/auth/me` returns the current account without
the password hash. Public registration cannot assign recycler or operator roles.
Cross-origin browser POSTs are rejected. Session cookies use SameSite=Lax and are
marked Secure outside development.

The `/demo` page has three password-free buttons for judges. Each button calls
`POST /api/auth/demo`; the server permits only a specific seeded email, expected
role, and `isDemo: true` record. The client never receives a demo password.
`/dashboard/user`, `/dashboard/recycler`, and `/dashboard/operator` have navigation
guards and server API authorization. An absent session gets HTTP 401 on protected
APIs; a session with the wrong role gets HTTP 403. Role checks read MongoDB so a
changed or deleted account does not retain access through an old cookie.
To run the HTTP checks locally, start `npm run dev -- --port 3001` in one terminal,
then run `npm run test:auth` in another. The check covers all three role guards,
cookie flags, demo sessions, registration, login, and logout. It removes its own
temporary registration record. Set `AUTH_TEST_URL` if the server uses another URL.

## Health and MongoDB

`GET /api/health` connects lazily through Mongoose and performs a real database ping.
Concurrent initial requests share one connection attempt; failures can be retried.
Driver errors are sanitized and responses are never cached.

- HTTP 200: `{"status":"ok","database":"connected"}`
- HTTP 503 without a URI: `{"status":"error","database":"not_configured"}`
- HTTP 503 if connection/ping fails: `{"status":"error","database":"unavailable"}`

A healthy response requires an accessible MongoDB instance. Missing configuration
never produces a fake success. The landing page and build work without MongoDB.

## Secrets and deployment

Only `runtimeConfig.public.appUrl` is browser-visible. The requested unprefixed
variables are resolved by `server/utils/config.ts` at **request time**, so they work
with the built Nitro server as well as local development. Standard Nuxt-prefixed
private runtime overrides (such as `NUXT_MONGODB_URI`) also work; the unprefixed
variable wins when both are set.

Set production environment variables through the host, then run
`node .output/server/index.mjs`. Nitro does not automatically load a production
`.env`; for a local production test, Node 24 supports
`node --env-file=.env .output/server/index.mjs`.

`PAYSTACK_PUBLIC_KEY` stays private in this phase along with the secret key.
Completing a pickup creates a mock `Transaction` only. Real Paystack payouts are
not implemented. Future payment work must enforce TEST mode.

Sessions use H3 encrypted, integrity-protected HttpOnly cookies, SameSite=Lax,
a one-day lifetime and Secure outside development. Header-based sessions are disabled.
Passwords use salted scrypt and timing-safe verification; no JWT or hashing package
is necessary. Auth POST endpoints check request origin. Session revocation across
devices and distributed sign-in rate limiting remain future hardening work before
any production launch.

## Integrations

- Mongoose: shared, bounded-timeout database connection.
- Zod: request validation and password/session constraints.
- Byteship: official `@byteship/js` SDK and scoped browser upload tokens.
- OpenRouter: server-side vision request with strict JSON schema, timeout and sanitized provider errors.
- Chart.js: lazy client loading with cleanup; no chart/dashboard data yet.

AI identifies materials only. Future financial values must come from deterministic
server calculations using recycler pricing in MongoDB. Weight, location and
availability must come from explicit data, never AI guesses. Any future seed data
must be labeled as demo data.

Documentation:
[Nuxt](https://nuxt.com/docs/4.x),
[Mongoose](https://mongoosejs.com/docs/connections.html),
[H3 sessions](https://h3.dev/examples/handle-session),
[Byteship](https://byteship.dev/docs/uploading-a-file),
[OpenRouter](https://openrouter.ai/docs/quickstart),
[Chart.js](https://www.chartjs.org/docs/latest/getting-started/integration.html).
