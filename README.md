# Recykle AI — Phase 3

A Lagos-focused recycling coordination hackathon prototype built with Nuxt 4,
strict TypeScript and Tailwind CSS 4. Phase 3 adds secure account sessions and
three role workspaces to the MongoDB foundation. The UI has **no live
classification, quotes, matching, pickup workflows or analytics dashboards**.

## Local setup

Use Node.js 24 LTS and npm.

1. Run `npm install` (use `npm.cmd` in PowerShell if script execution is disabled).
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB Atlas URI. Configure an Atlas database user and
   network access for your machine. Never paste credentials into commits or logs.
4. Generate `SESSION_SECRET` locally:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Run `npm run dev` and open http://localhost:3000.

External AI, storage and payment keys may remain empty through Phase 3.
Set `SESSION_SECRET` to at least 32 random characters before using authentication.

## Commands

- `npm run dev`: development server
- `npm run lint`: ESLint
- `npm run typecheck`: strict Nuxt/Vue TypeScript checks
- `npm test`: password hashing checks
- `npm run build`: production build
- `npm run seed`: insert labelled demo data and verify MongoDB indexes
- `npm run test:auth`: HTTP auth checks against a running dev server on port 3001
- `npm run preview`: local production preview

## Structure

Nuxt 4 frontend directories live under `app/`; do not add duplicate root pages or components.

```text
app/
  pages/          Landing page and public workspace preview
  layouts/        Public and dashboard shells
  components/     Brand, navigation, Button, Card, Badge, Modal,
                  EmptyState, LoadingSkeleton, StatCard
  composables/    Lazy Chart.js loader and health request
  middleware/     Role-aware navigation guards
  assets/css/     Tailwind entry, design tokens and responsive styles
server/
  api/            HTTP endpoints
  middleware/     Response headers
  models/         Mongoose operational models and GeoJSON validation
scripts/           Repeatable labelled demo seed and index verification
  services/       Password hashing and integration clients
  utils/          Configuration, database, sessions and validation
types/            Shared contracts; never put secrets here
utils/            Pure presentation utilities
tests/            Security utility tests
```

Frontend components own presentation only. Future request bodies use Zod through
`readValidatedJson`. Future protected endpoints use server authorization; client
middleware is not an authorization boundary.

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
Payment processing is not implemented. Future payment work must enforce TEST mode.

Sessions use H3 encrypted, integrity-protected HttpOnly cookies, SameSite=Lax,
a one-day lifetime and Secure outside development. Header-based sessions are disabled.
Passwords use salted scrypt and timing-safe verification; no JWT or hashing package
is necessary. Auth POST endpoints check request origin. Session revocation across
devices and distributed sign-in rate limiting remain future hardening work before
any production launch.

## Integrations

- Mongoose: shared, bounded-timeout database connection.
- Zod: request validation and password/session constraints.
- Byteship: official `@byteship/js` SDK, server-only factory; no upload endpoint yet.
- OpenRouter: native server fetch with timeout and sanitized provider errors.
- Chart.js: lazy client loading with cleanup; no chart/dashboard data yet.

AI will identify materials only. Future financial values must come from deterministic
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
