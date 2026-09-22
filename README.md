# Recykle AI — Phase 1

A Lagos-focused recycling coordination hackathon prototype built with Nuxt 4,
strict TypeScript and Tailwind CSS 4. This phase contains the application foundation:
a public landing page, a public workspace shell, reusable UI and server utilities.
It has **no live classification, quotes, matching, pickup workflows or dashboards**.

## Local setup

Use Node.js 24 LTS and npm.

1. Run `npm install` (use `npm.cmd` in PowerShell if script execution is disabled).
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB Atlas URI. Configure an Atlas database user and
   network access for your machine. Never paste credentials into commits or logs.
4. Generate `SESSION_SECRET` locally:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Run `npm run dev` and open http://localhost:3000.

External AI, storage and payment keys may remain empty during Phase 1.
Authentication helpers reject missing/short secrets; there is no sign-in endpoint yet.

## Commands

- `npm run dev`: development server
- `npm run lint`: ESLint
- `npm run typecheck`: strict Nuxt/Vue TypeScript checks
- `npm test`: password hashing checks
- `npm run build`: production build
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
  middleware/     Future client navigation guards
  assets/css/     Tailwind entry, design tokens and responsive styles
server/
  api/            HTTP endpoints
  middleware/     Response headers
  models/         Reserved for phase-specific Mongoose models
  services/       Password hashing and integration clients
  utils/          Configuration, database, sessions and validation
types/            Shared contracts; never put secrets here
utils/            Pure presentation utilities
tests/            Security utility tests
```

Frontend components own presentation only. Future request bodies use Zod through
`readValidatedJson`. Future protected endpoints use server authorization; client
middleware is not an authorization boundary.

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
is necessary. Session revocation, sign-in rate limiting and CSRF protection for
state-changing endpoints belong to the authentication phase, before exposing them.

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
