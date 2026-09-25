# ReCircle ♻️

ReCircle is a Nigeria-focused recycling coordination platform that makes recycling more practical, transparent, and rewarding. It helps people identify recyclable materials, estimate their value, find suitable nearby recyclers, and request pickups—all from one streamlined experience.

Built to connect consumers, recycling businesses, and waste operators, ReCircle turns the journey from “I have recyclable waste” into a clear, trackable workflow.

## Inspiration 🧠

Recycling often breaks down before it begins: people may not know whether an item is recyclable, how to prepare it, what it is worth, or where to take it. Meanwhile, recyclers need a reliable way to discover available materials and manage collection capacity.

ReCircle was created to close that gap. The goal was to build a digital bridge between households, recyclers, and operators—making recycling easier to participate in while helping valuable materials stay out of landfills.

## What it does ❔

ReCircle supports three key roles:

- **Consumers** can scan or upload waste images, receive AI-assisted material identification, review preparation guidance, estimate waste value, compare nearby recyclers, and request pickups.
- **Recyclers** can manage their service areas, accepted materials, pricing rules, collection capacity, and incoming pickup requests.
- **Waste operators** can monitor platform activity, track pickup progress, review recycler utilization, and plan more efficient collection batches.

The platform follows the full recycling journey:

`Scan waste → Analyze material → Add weight → Match recycler → Request pickup → Collect → Complete payment`

## Key features ✨

- AI-assisted waste classification with confidence scores and safety/preparation guidance
- Consumer confirmation and correction when AI confidence is low
- Location-aware recycler matching based on distance, pricing, accepted materials, service radius, and available capacity
- Transparent estimated recycling value in Nigerian Naira (NGN)
- Pickup request lifecycle with clear statuses from pending to completed
- Role-based dashboards for consumers, recyclers, operators, and administrators
- Collection-batch suggestions to help operators organize pickups efficiently
- Analytics for materials, collections, payouts, recycler capacity, and pickup activity
- A grounded AI assistant that answers questions using available ReCircle data without inventing prices, earnings, pickup statuses, or distances
- Secure authentication through Google sign-in or email OTP verification

## How we built it 🖥️

ReCircle is built with **Nuxt 4**, **Vue 3**, **TypeScript**, and **Tailwind CSS 4** for a fast, responsive frontend experience.

The backend uses **Nuxt server APIs**, **MongoDB**, and **Mongoose** to manage users, recyclers, waste items, pickup requests, transactions, notifications, and analytics. MongoDB’s GeoJSON and geospatial indexing power nearby recycler discovery and location-based matching.

We also integrated **OpenRouter** for structured waste-image analysis, **Byteship** for secure uploads, **Google Maps** for pickup-location selection and geocoding, **Google OAuth** and **Resend OTP** for authentication, **Paystack** for payout-ready transaction flows, **Chart.js** for analytics, and **Zod** for API validation.

## Challenges we ran into 🏃

One of the biggest challenges was making AI useful without allowing it to become unreliable. Instead of trusting AI output blindly, ReCircle validates every response against a strict schema, applies confidence thresholds, and lets users correct uncertain classifications.

Recycler matching was another complex area. A nearby recycler is not automatically the best recycler, so the platform evaluates distance, material acceptance, service radius, pricing, and remaining capacity before making a recommendation.

We also had to design role-specific workflows that remain connected: consumers need a simple recycling experience, recyclers need operational clarity, and operators need oversight without being able to alter restricted actions.

## Accomplishments we’re proud of 🚀

We are especially proud of building more than a recycling directory. ReCircle supports the actual operational flow behind recycling—from waste discovery to matching, pickup tracking, and completion.

- A deterministic recycler-ranking system rather than AI-generated recommendations
- Secure, scoped image uploads
- Strict pickup status transitions that prevent invalid workflow changes
- Capacity-aware recycler recommendations
- Mobile-responsive dashboards for every user role
- Analytics built from real platform data instead of misleading environmental estimates
- An AI assistant designed to stay grounded in verified platform data

## What we learned 📖

Building ReCircle strengthened our understanding of full-stack product development, especially role-based access control, geospatial queries, secure authentication, AI integration, and operational workflow design.

We also learned that responsible AI requires boundaries. By combining AI analysis with validation, user confirmation, and deterministic business logic, we created a more trustworthy experience than relying on generated answers alone.

Most importantly, ReCircle showed us how technology can make sustainable actions feel simpler, more accessible, and more connected to real-world impact.

---

## Technical documentation

Phase 11 adds a grounded ReCircle assistant that explains platform data from MongoDB and never invents pricing, earnings, status, distance, or confidence.

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
- `npm test`: password, model, classification, matching, lifecycle, dashboard and assistant helper checks
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
                  DashboardMetrics, IncomingRequestCard, BreakdownList, CapacityMeter,
                  AnalyticsChart, AiAssistantDrawer
  composables/    Auth, scanner upload, pickup location, chart and health state
  middleware/     Role-aware navigation guards
  assets/css/     Tailwind entry, design tokens and responsive styles
server/
  api/            HTTP endpoints
  middleware/     Response headers
  models/         Mongoose operational models and GeoJSON validation
  services/       Password hashing, classification, matching, pickup requests,
                  analytics, assistant context and clients
  utils/          Configuration, database, sessions and validation
scripts/           Demo seed and live HTTP verification
types/            Shared contracts; never put secrets here
utils/            Pure formatting, classification, matching, lifecycle and assistant utilities
tests/            Password, model, classification, matching, lifecycle and assistant tests
```

Frontend components own presentation only. Request bodies use Zod through
`readValidatedJson`. Protected endpoints use server authorization; client
middleware is not an authorization boundary.

## Waste scanner and uploads

Consumers can open `/scan` from their workspace. The page accepts JPEG, PNG, and
WEBP images up to 5 MB, including a phone camera input where supported. Device
location requires browser permission; manual coordinates are available if it fails.
Seeded consumer accounts start with an explicitly labelled demo Nigeria pickup point.
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
completed mock `Transaction` for the expected payout (or a pending Paystack
Transfer when TEST keys and a consumer payout recipient are configured). Responses include audit
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
pending and accepted requests, filters by a Nigerian zone, clusters nearby pickups with
a deterministic radius heuristic, then orders each cluster with nearest-neighbour.
The UI labels this a **Suggested collection sequence** and compares naive vs suggested
straight-line distance. An SVG marker map is included; no paid routing API is used.
This endpoint never mutates WasteItem, Request, or capacity state, so the scan → match
→ request flow stays unchanged.


## Analytics

`GET /api/analytics` returns role-scoped chart data from `AnalyticsService`.
Aggregations run in MongoDB (monthly kg, payouts, material mix, status counts,
recycler utilization, and zone distribution from coordinate buckets). The
`/dashboard/analytics` page renders donut, line, bar, and horizontal-bar charts
with loading and empty states. Charts do not invent trees-saved or CO₂ claims.

## ReCircle assistant

`POST /api/ai-recommendation` accepts a short chat message (optional history and
focus IDs). The server loads role-scoped facts from MongoDB — recent items,
requests, earnings, demo recycler pricing, distances, and classification fields —
then calls OpenRouter with a grounding prompt. The model must not invent recycler
pricing, pickup availability, earnings, transaction status, recycler distance, or
classification confidence. Answers should separate **From your ReCircle data** from
**General recycling advice**. The assistant never writes or updates records.

A compact `AiAssistantDrawer` sits on the dashboard layout (floating button + side
panel) so judges can ask about prep steps, habits, classifications, pickup status,
estimated value, and recycling opportunities without leaving the workspace.

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
one consumer, one waste operator, four fictional Nigerian recycler businesses, and
four historical completed requests with mock transactions. **All recycler prices
are invented DEMO values, not real market quotes.** Never use this data for actual
payouts or collection decisions. The script creates and verifies every declared
index without dropping existing indexes.

Prices, estimates, and payouts are stored as numeric NGN amounts. The demo uses
whole naira. Future payment logic should define rounding and precision rules before
any real transaction is processed.

## Accounts and role access

Signup starts with a **role** step, then Google-first identity (or email OTP).

- `POST /api/auth/google` accepts `{ idToken, role? }` — verifies a Google ID token,
  creates or links the account (`googleId`, no password), and starts a session.
  New Google users must include `role` from the register role step.
- Email path: `POST /api/auth/signup/start` (`name`, `email`, `role`) sends a Resend OTP;
  `verify-otp` returns a signup token; `complete` sets the password and session.
- `POST /api/auth/login` is email/password only. Google-only accounts get a clear
  error to use Continue with Google instead.
- `POST /api/auth/logout` clears the encrypted HttpOnly session cookie;
  `GET /api/auth/me` returns the current account without the password hash.

Set `GOOGLE_CLIENT_ID` and `NUXT_PUBLIC_GOOGLE_CLIENT_ID` to the same Google Cloud
OAuth **Web** client ID (authorized JavaScript origins = your app URL).
Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for real OTP mail; without a Resend key,
local signup uses fixed OTP `424242`.

Cross-origin browser POSTs are rejected. Session cookies use SameSite=Lax and are
marked Secure outside development. New accounts finish onboarding (avatar, then
role-specific steps) before dashboards unlock.

Seeded accounts remain available for local development via `npm run seed` and
password login. `POST /api/auth/demo` is kept for automated HTTP checks only; there
is no public demo page.
`/dashboard/user`, `/dashboard/recycler`, and `/dashboard/operator` have navigation
guards and server API authorization. An absent session gets HTTP 401 on protected
APIs; a session with the wrong role gets HTTP 403. Guests hitting protected pages
are redirected to `/login`. Role checks read MongoDB so a changed or deleted
account does not retain access through an old cookie.
To run the HTTP checks locally, start `npm run dev -- --port 3001` in one terminal,
then run `npm run test:auth` in another. The check covers all three role guards,
cookie flags, seeded demo sessions, email-first registration, login, and logout. It
removes its own temporary registration record. Set `AUTH_TEST_URL` if the server
uses another URL.

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

`PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` must be **TEST** keys
(`sk_test_` / `pk_test_`). Live keys are rejected. When both are set and the
consumer has saved a NUBAN payout account in Settings, completing a pickup
creates a `pending` Paystack Transfer (amount in kobo) with reference
`recircle_<requestId>`. Webhooks at `POST /api/paystack/webhook` (HMAC SHA512
via `x-paystack-signature`) mark the transaction completed or failed. Without
keys or a recipient, completion still records a mock completed reward so local
demos keep working. Point your Paystack dashboard webhook URL at
`https://<host>/api/paystack/webhook` (use a tunnel such as ngrok for local TEST).

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
- OpenRouter: server-side vision classification and grounded assistant chat; timeout and sanitized provider errors.
- Paystack: TEST-only Transfer payouts for recycling rewards; webhook signature verification.
- Chart.js: lazy client loading with cleanup for role analytics charts.

AI identifies materials and explains stored platform facts. Financial values come from
deterministic server calculations using recycler pricing in MongoDB. Weight, location and
availability come from explicit data, never AI guesses. Seed data is labelled as demo data.

Documentation:
[Nuxt](https://nuxt.com/docs/4.x),
[Mongoose](https://mongoosejs.com/docs/connections.html),
[H3 sessions](https://h3.dev/examples/handle-session),
[Byteship](https://byteship.dev/docs/uploading-a-file),
[OpenRouter](https://openrouter.ai/docs/quickstart),
[Chart.js](https://www.chartjs.org/docs/latest/getting-started/integration.html).
