/**
 * Production configuration guard.
 *
 * In production Launchr must never run on the in-memory fallback store or on a
 * guessable auth secret. Instead of crashing at import time (which makes Vercel
 * return an opaque 500), the app reports exactly which variables are missing
 * (names only, never values) via a 503 response and /api/health.
 */
export const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
] as const;

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

/** Vercel preview deployments get a unique URL per deployment and per branch. */
export function isVercelPreview(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "preview" && Boolean(env.VERCEL_URL?.trim());
}

/**
 * Public origin(s) of this deployment, used as the BetterAuth base URL and the
 * trusted-origin list. BETTER_AUTH_URL always wins (production). On a Vercel
 * preview with no BETTER_AUTH_URL, the deployment URL and the branch URL are used,
 * so pull-request previews can sign in without touching production settings.
 */
export function getAppOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const explicit = env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "");
  if (explicit) return [explicit];
  if (isVercelPreview(env)) {
    return [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
      .map(host => host?.trim())
      .filter((host): host is string => Boolean(host))
      .map(host => `https://${host}`);
  }
  return [];
}

export function getMissingProductionConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) return [];
  const missing: string[] = REQUIRED_PRODUCTION_ENV.filter(key => {
    if (key === "BETTER_AUTH_URL" && isVercelPreview(env)) return false; // derived per preview
    return !env[key]?.trim();
  });
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (secret && secret.length < 32) missing.push("BETTER_AUTH_SECRET (must be at least 32 characters)");
  return missing;
}
