# Route middleware

`auth.ts` redirects guests from role dashboards to `/login` and signed-in users
to the dashboard for their current role. Incomplete onboarding is sent to the
matching `/onboarding/*` route. The guard calls `/api/auth/me`, which reads the
role from MongoDB on every request. Server API routes still call
`requireSessionUser`; client navigation is not the authorization boundary.
The scanner and analysis handoff routes are restricted to consumer accounts.
