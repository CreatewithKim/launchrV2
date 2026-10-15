# Launchr Vercel Deployment Guide

> **Start here:** [docs/CICD-DEPLOYMENT.md](docs/CICD-DEPLOYMENT.md) is the step-by-step guide for deploying to Vercel through GitHub with CI/CD (checks on every pull request, preview deployments, migrate-then-deploy on merge to `main`).

This repository is configured for zero-friction deployment to Vercel with a single unified build pipeline.

## Why Previous Deployments Failed

1. **Missing Lockfile with `--frozen-lockfile`**: `vercel.json` previously specified `"installCommand": "pnpm install --frozen-lockfile"`, but no `pnpm-lock.yaml` existed in the repository. This caused pnpm to immediately abort with `ERR_PNPM_NO_LOCKFILE: Headless installation requires a pnpm-lock.yaml file, but none was found`.
2. **Conflicting API Endpoints**: The `api/` directory contained both `api/index.js` and `api/handler.ts`. Vercel automatically deploys every file in `api/` as a serverless function, causing a redundant and failing build for `handler.ts`.
3. **Peer Dependency Strictness**: Modern npm versions could halt on React 19 peer dependency warnings without `--legacy-peer-deps`.

## Fixes Applied

1. **Standardized Install & Build**:
   - Added `.npmrc` with `legacy-peer-deps=true`.
   - Committed a complete, valid `package-lock.json`.
   - Updated `vercel.json` with:
     - `"installCommand": "npm install --legacy-peer-deps"`
     - `"buildCommand": "npm run build"`
     - `"outputDirectory": "dist/public"`
2. **Clean Serverless Function Structure**:
   - Moved `api/handler.ts` to `server/vercelHandler.ts` so `api/` only contains `api/index.js`.
   - Updated `esbuild` target in `package.json` to bundle `server/vercelHandler.ts` into `dist/vercel-api.mjs`.
   - Added path normalization middleware in `server/app.ts` so all Vercel URL rewrites to `/api` route directly to the Express endpoints.

## Environment Variables

**Required in production.** While any of these are missing, every API route returns `503 {"status":"misconfigured","missing":[...]}` (names only) instead of running on an unsafe fallback.

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string (TiDB Cloud, PlanetScale, Aiven, Railway, etc.). Migrations run automatically at the start of every Vercel build (`npm run db:migrate`); to run them by hand: `DATABASE_URL=... npm run db:migrate`. |
| `BETTER_AUTH_SECRET` | 32+ random characters, e.g. `openssl rand -base64 48`. Keep it stable; changing it signs everyone out. |
| `BETTER_AUTH_URL` | Public origin of the app, e.g. `https://launchr-chi.vercel.app`. Also used as the only trusted origin in production. |

Optional: `GEMINI_API_KEY` (AI outreach copy; deterministic fallback copy is used if unset), `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`.

**Production never uses the in-memory store.** If the database is unreachable the request fails with an error rather than silently losing data. The in-memory store exists for local development and tests only.

## First deploy checklist

1. Create the MySQL database and run `npx drizzle-kit migrate` (creates app tables plus BetterAuth `user`, `session`, `account`, `verification`).
2. Set the three required variables in Vercel and redeploy.
3. Check `https://<your-app>/api/health` returns `{"status":"ok"}`.
4. Sign up, sign out, sign in again. Accounts now persist across serverless cold starts.
5. Optional: promote yourself to admin (new accounts are regular users): `UPDATE users SET role='admin' WHERE email='you@example.com';`

## Tests

- `npm test` runs unit and isolation tests (in-memory mode).
- Real-database tests: `TEST_DATABASE_URL=mysql://user:pass@host:3306/db npx vitest run server/sql.integration.test.ts` (migrations must already be applied; use a throwaway database).

## Vercel Project Settings

In your Vercel Project Dashboard:
- **Framework Preset**: Other / Vite
- **Root Directory**: `./` (leave default)
- **Install Command**: `npm install --legacy-peer-deps` (configured automatically via `vercel.json`)
- **Build Command**: `npm run build` (configured automatically via `vercel.json`)
- **Output Directory**: `dist/public` (configured automatically via `vercel.json`)
