# Course API proxy

The application still saves courses and rounds in localStorage. This Worker only
proxies course-provider reads; it is not the application's database.

Use Node 22.12+ for the standalone Worker tooling (the root app still uses Node 20).
Run `npm install` in this directory, then `npm run dev`. Configure secrets with
`npx wrangler secret put GOLFCORE_API_KEY` and
`npx wrangler secret put GOLFCOURSEAPI_KEY` (or a local, untracked `.dev.vars`).
GolfCore can run keyless while the provider permits it; GolfCourseAPI cannot.
Set `VITE_COURSE_API_URL` in the app to the Worker URL, without a trailing route.
Never put provider keys in Vite environment variables or browser code.

`ALLOWED_ORIGINS` is a comma-separated exact-origin allowlist. Defaults include
the GitHub Pages origin and Vite localhost origins on port 5173. Change it for
other development ports. CORS is not authentication: non-browser clients can
call this public proxy. Configure Cloudflare rate limiting before a public
rollout if quota abuse is a concern. Successful reads are cached for 24 hours;
errors and credentials are not cached. Provider attribution and data licences
still apply to data displayed by the application.

No deployment is performed by the root app build.
