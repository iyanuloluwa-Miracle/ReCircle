# Route middleware

`auth.ts` redirects guests from role dashboards to `/demo` and signed-in users
to the dashboard for their current role. The guard calls `/api/auth/me`, which
reads the role from MongoDB on every request. Server API routes still call
`requireSessionUser`; client navigation is not the authorization boundary.
