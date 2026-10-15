# Launchr: Deploying to Vercel via GitHub with CI/CD

**Result:** every pull request gets automated checks and a preview URL; merging to `main` deploys to production automatically, after the database is migrated, and only if checks passed.

**What I verified:** all workflow commands (install, type check, tests, build, migrate on an empty database, real-database tests) ran locally from a clean copy, and the workflow file passes `actionlint`. **What I could not verify:** GitHub Actions and Vercel themselves (I have no access to your accounts). The Vercel and GitHub screens below are described from how those products normally work, so labels may differ slightly. Where I'm unsure, I say so.

---

## How it fits together

```
feature branch ──push──▶ Pull Request ──▶ GitHub Actions CI (verify, database-tests)
                              │                      │
                              ▼                      ▼
                    Vercel PREVIEW deploy      must be green to merge
                    (preview database)                │
                                                      ▼
                         merge to main ──▶ Vercel PRODUCTION deploy
                                           build = migrate production DB, then build app
                                           if migrate or build fails, the old version stays live
```

| Layer | Tool | Job |
|-------|------|-----|
| CI (quality gate) | GitHub Actions (`.github/workflows/ci.yml`) | Type check, tests, build, real-MySQL tests, audit |
| Merge gate | GitHub branch ruleset on `main` | Blocks merging unless CI is green |
| CD (release) | Vercel Git integration | Preview on every branch/PR, production on `main` |
| Database changes | `npm run db:migrate` inside the Vercel build | Applies new migrations before the new code goes live |

---

## Part 0. Before you start

You need: a GitHub account, a Vercel account, a MySQL host, and Node 22 plus Git on your computer. Node 22 is pinned in `package.json` (`engines`) and `.nvmrc`.

**Pick a MySQL host that works from serverless functions** (TiDB Cloud, PlanetScale, Aiven, Railway, or similar). You need **two databases**:

| Database | Used by | Why separate |
|----------|---------|--------------|
| `launchr_prod` | Production deployments | Real customer data |
| `launchr_preview` | Preview deployments (every PR) | Tests and experiments must never touch real data |

Each gives you a connection string like `mysql://user:password@host:3306/dbname`. Many hosts require TLS; copy the exact string and any SSL parameter from your host's docs. The same string is used by the app and by migrations.

**Generate your auth secrets** (one per environment, 32+ characters):

```bash
openssl rand -base64 48
```

---

## Part 1. Put the code on GitHub

1. **Unzip the project** (`launchr-main-cicd-ready.zip`) and open a terminal inside the folder.
2. **Confirm no secrets are included.** There should be no `.env` file, only `.env.example`. `.gitignore` already excludes `.env*`, `dist/`, `node_modules/` and `.vercel`.
3. **Create an empty repository** on GitHub (github.com, then New repository). Name it `launchr`, set it to **Private**, and do **not** add a README, .gitignore or licence.
4. **Initialise and push:**

   ```bash
   git init -b main
   git add .
   git commit -m "Initial commit: Launchr with CI/CD"
   git remote add origin https://github.com/<your-user>/launchr.git
   git push -u origin main
   ```

5. **Check the push:** the repo should show a `.github/workflows/ci.yml` file. Open the **Actions** tab. A "CI" run starts on the push to `main`. All three jobs (`verify`, `database-tests`, `audit (informational)`) should turn green. The audit job may show a warning about the known Drizzle ORM advisory (F14); it is set not to block.

> If the first CI run fails, open the failed step's log; the usual cause is a typo in a pasted file. Fix it, commit, and push again.

---

## Part 2. Create the Vercel project from GitHub

1. In Vercel, choose **Add New, then Project**, and **Import** your `launchr` repository. If it isn't listed, click **Adjust GitHub App Permissions** and grant Vercel access to that repo.
2. **Project settings on the import screen:**

   | Setting | Value |
   |---------|-------|
   | Framework Preset | Other |
   | Root Directory | `./` |
   | Build / Install / Output | Leave defaults. `vercel.json` sets them (`npm ci --legacy-peer-deps`, `npm run db:migrate && npm run build`, `dist/public`) and overrides the dashboard. |

3. **Do not deploy yet.** Add the environment variables first (Part 3). If you click Deploy now, the build will stop with `DATABASE_URL is required`, which is the safe failure, but it's cleaner to set variables first.

> **If you already have a live Vercel project** (`launchr-chi`): open that project, go to **Settings, Git**, and connect it to the new GitHub repository instead of importing a second project. Then continue with Part 3.

---

## Part 3. Environment variables

In Vercel: **Project, Settings, Environment Variables**. For each variable choose the environments it applies to.

| Variable | Production | Preview | Notes |
|----------|:---:|:---:|-------|
| `DATABASE_URL` | prod DB string | **preview DB string** | Must be different values. Required for the build and the app. |
| `BETTER_AUTH_SECRET` | secret A | secret B | 32+ characters. Use different secrets per environment. Changing one signs that environment's users out. |
| `BETTER_AUTH_URL` | `https://your-domain` | **leave unset** | No trailing slash. In Preview it is derived automatically from the deployment URL. |
| `GEMINI_API_KEY` | key | key (or a low-quota key) | Optional. Enables AI outreach copy. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | optional | skip | Social login works on production only, because OAuth redirect URLs must be fixed. |

Rules of thumb:
- **Never put secrets in GitHub or in the repo.** They live in Vercel (and GitHub Secrets only if you later add Option B).
- If a variable is marked "Sensitive" in Vercel, you can't read it back later, which is what you want for secrets.
- Do not tick Development unless you use `vercel dev`.

**What happens if something is missing:**
- No `DATABASE_URL` at build time: the build fails with `DATABASE_URL is required to run drizzle commands`, and **the previous production deployment keeps serving**.
- `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` missing at runtime: the API answers `503 {"status":"misconfigured","missing":[...]}` (names only).

---

## Part 4. First production deploy

1. In Vercel, open the project and click **Deploy** (or push a new commit to `main`). The build runs `npm run db:migrate` first. On an empty production database this creates all tables, including the BetterAuth ones.
2. **Wait for "Ready."** If it fails, open the build log (see Troubleshooting).
3. **Health check:** open `https://<your-domain>/api/health`. Expected: `{"status":"ok"}`.
4. **Smoke test in the browser:**
   - Sign up with a 10+ character password.
   - Sign out and sign in again.
   - Add a customer; refresh; it should still be there.
   - Open the app in a private window: you should be sent to the login page, not see data.
5. **Make yourself admin** (new accounts are regular users). Using your database host's SQL console:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
   ```

6. **Take a backup point.** Enable automated backups on the production database in your host's dashboard before real users arrive.

---

## Part 5. Turn on the merge gate (this is what makes it CI/CD)

Without this step, CI only reports; with it, broken code cannot reach production.

In GitHub: **repo, Settings, Rules, Rulesets, New branch ruleset** (older UI: **Settings, Branches, Add branch protection rule**). Target the **`main`** branch and enable:

| Setting | Value |
|---------|-------|
| Require a pull request before merging | On (approvals: 0 if you work alone) |
| Require status checks to pass | On. Add **`verify`** and **`database-tests`** |
| Require branches to be up to date | On |
| Block force pushes and deletion | On |

The check names appear in the picker only after CI has run once (Part 1, step 5 did that). The `audit` job is deliberately not required.

Also in GitHub: **Settings, General, Pull Requests**: enable **Automatically delete head branches**.

---

## Part 6. Your daily workflow

```bash
git checkout -b feature/short-description
# ...make changes, then run the same checks CI runs:
npm run check && npm test && npm run build
git add -A && git commit -m "Describe the change"
git push -u origin feature/short-description
```

1. **Open a Pull Request** on GitHub.
2. **Two things start automatically:**
   - GitHub Actions: `verify` and `database-tests`.
   - Vercel: a **preview deployment** with its own URL, posted as a comment on the PR. It uses your preview database and runs migrations against it.
3. **Test on the preview URL.** Sign-up and sign-in work there (email and password). Social login does not.
   - If Vercel shows a login wall on previews, that is Deployment Protection (team members sign in with Vercel). This is a Vercel project setting; keep it on.
4. **Merge when both checks are green.** Merging to `main` triggers the production deploy.
5. **Watch the production deployment** finish, then open `/api/health` and do a 30-second smoke test.

### Database changes (important)

Add a migration whenever you change `drizzle/schema.ts`:

```bash
# local database URL in your shell, never committed
DATABASE_URL="mysql://..." npx drizzle-kit generate --name short_description
git add drizzle/ && git commit -m "Add migration: short_description"
```

Commit the generated `.sql` and `meta/` files. CI applies every migration to an empty MySQL database, so a broken migration fails the PR. Production applies new migrations at the start of the build.

**Keep migrations backward compatible** (add columns and tables; don't rename or drop in the same release). Reason: if the app code fails after the migration succeeded, a rollback restores old code that must still work with the new schema. To remove or rename something, do it in two releases: first stop using it, then drop it later.

MySQL schema changes are not transactional, so a migration that fails halfway can leave the database partly changed. Try risky migrations on the preview database first.

---

## Part 7. Rollback and recovery

| Situation | What to do |
|-----------|-----------|
| Bad release, app misbehaves | In Vercel: **Deployments**, find the last good production deployment, use **Instant Rollback** (or Promote). Takes effect in seconds. Then fix forward via a PR. |
| Build or migration failed | Nothing to do: production keeps serving the previous deployment. Read the build log, fix, push. |
| Bad data change | Restore from your database host's backup/point-in-time recovery. Rollback restores code, not data. |
| Leaked secret | Rotate it at the source (database password, Gemini key), update it in Vercel, redeploy. Rotating `BETTER_AUTH_SECRET` signs everyone out. |

---

## Part 8. Custom domain (recommended before launch)

1. Vercel: **Project, Settings, Domains**, add your domain and follow the DNS instructions.
2. Update `BETTER_AUTH_URL` (Production) to the exact new origin, e.g. `https://app.yourdomain.com`, and redeploy. A mismatch is the most common cause of "sign-in does nothing."
3. If you use Google or GitHub login, add `https://app.yourdomain.com/api/auth/callback/google` (and `/github`) as the authorised redirect URL in each provider.

---

## Part 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails: `DATABASE_URL is required to run drizzle commands` | Variable missing for that environment (Production vs Preview) | Add it for the right scope, redeploy |
| Build fails during migration: connection refused, timeout, or SSL error | Host blocks Vercel's build network, or needs TLS | Allow public connections (or the host's recommended serverless setting) and add the host's SSL parameter to the URL |
| Build fails: `ERESOLVE` or lockfile out of sync | `package.json` changed without updating `package-lock.json` | Run `npm install --legacy-peer-deps` locally and commit the lockfile |
| API returns `503 misconfigured` | Required variable missing at runtime | Read the `missing` list and set it for that environment |
| `/api/health` OK but sign-in fails silently | `BETTER_AUTH_URL` doesn't match the address you're visiting (domain, `www`, trailing slash) | Set it to the exact origin, no trailing slash, redeploy |
| Preview can't sign in | `BETTER_AUTH_URL` was set for Preview scope, so it overrides the derived URL | Remove it from Preview |
| Everyone was signed out after a deploy | `BETTER_AUTH_SECRET` changed | Expected. Keep it stable |
| AI calls time out | Serverless function duration limit on your plan | Check the function duration limit for your Vercel plan; raise it in `vercel.json` `functions` if your plan allows |
| CI `database-tests` fails but local passes | Migration or MySQL 8 difference | Read the step log; reproduce with a local MySQL 8 using the same URL |
| Required check never starts on a PR | Check names don't match the ruleset | Re-select `verify` and `database-tests` after one CI run |

---

## Appendix A. What was changed in the repo for this guide

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | New. Jobs: `verify` (npm ci, type check, tests, build, bundle check), `database-tests` (MySQL 8 service, migrate empty DB, real-DB tests), `audit` (informational) |
| `.github/dependabot.yml` | New. Weekly npm updates (grouped), monthly GitHub Actions updates |
| `vercel.json` | `installCommand` now `npm ci --legacy-peer-deps` (exact lockfile versions); `buildCommand` now `npm run db:migrate && npm run build` |
| `package.json` | Added `engines.node: 22.x` and `db:migrate` script |
| `.nvmrc` | New: Node 22 for local parity |
| `.gitignore` | Added `.vercel` |
| `server/_core/config.ts`, `server/auth.ts` | Preview deployments derive their auth origin from Vercel's URLs, so PR previews can sign in without touching production settings. 3 new tests |

## Appendix B. Optional: strict ordering with GitHub Actions deploys

The default flow migrates inside the Vercel build, which already guarantees migrate-then-deploy. Use this alternative only if you want GitHub, not Vercel, to run releases (for example, manual approval before production). **I have not run this one.**

1. In Vercel, **Settings, Git**, disable automatic production deployments (keep previews).
2. Create three GitHub secrets: `VERCEL_TOKEN` (from Vercel account tokens), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (from `.vercel/project.json` after running `npx vercel link` locally), plus `PRODUCTION_DATABASE_URL`.
3. Add `.github/workflows/release.yml`:

```yaml
name: Release
on:
  workflow_dispatch:
  push:
    branches: [main]
concurrency: { group: release, cancel-in-progress: false }
jobs:
  release:
    runs-on: ubuntu-latest
    environment: production        # add required reviewers here for manual approval
    env:
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci --legacy-peer-deps
      - run: npm run db:migrate
        env: { DATABASE_URL: "${{ secrets.PRODUCTION_DATABASE_URL }}" }
      - run: npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

Because `vercel build` would also run `db:migrate` (from `vercel.json`), either keep `DATABASE_URL` available to it (harmless, migrations are idempotent) or change `buildCommand` back to `npm run build`.

## Appendix C. Go-live checklist

- [ ] CI green on `main`; ruleset requires `verify` and `database-tests`
- [ ] Production and preview databases separate; backups enabled on production
- [ ] Production env vars set; Preview has no `BETTER_AUTH_URL`
- [ ] `/api/health` returns ok; sign-up, sign-out, sign-in verified
- [ ] You are admin; test accounts are not
- [ ] Custom domain live and `BETTER_AUTH_URL` updated
- [ ] Rollback practised once on a harmless change
- [ ] Still open from the test document before real users: real WhatsApp sending, email verification and password reset, rate limits, privacy policy and terms
