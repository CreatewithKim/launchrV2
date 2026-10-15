import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { baAccount, baSession, baUser, baVerification } from "../drizzle/schema";
import { getAppOrigins, isProduction } from "./_core/config";
import { getSqlClient } from "./_core/sqlClient";

// Never sign sessions with a string that exists in source control.
// Production requires BETTER_AUTH_SECRET (enforced by the config guard in app.ts);
// if it is somehow missing we use a random per-process secret so nothing is forgeable.
const secret =
  process.env.BETTER_AUTH_SECRET ||
  (isProduction() ? randomBytes(32).toString("hex") : "launchr-local-development-secret-not-for-production");

const appOrigins = getAppOrigins();
const baseURL = appOrigins[0] || "http://localhost:3000";

const sqlDb = getSqlClient();
if (!sqlDb && !isProduction()) {
  console.warn("[Auth] DATABASE_URL not set: accounts use an in-memory store (development only).");
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

const githubClientId = process.env.GITHUB_CLIENT_ID || "";
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";

const socialProviders: Record<string, any> = {};

if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    enabled: true,
  };
}

if (githubClientId && githubClientSecret) {
  socialProviders.github = {
    clientId: githubClientId,
    clientSecret: githubClientSecret,
    enabled: true,
  };
}

export const auth = betterAuth({
  secret,
  baseURL,
  // Persist users, sessions and OAuth accounts in MySQL. Without this BetterAuth
  // keeps them in process memory, which is lost on every serverless cold start.
  ...(sqlDb
    ? {
        database: drizzleAdapter(sqlDb, {
          provider: "mysql",
          schema: {
            user: baUser,
            session: baSession,
            account: baAccount,
            verification: baVerification,
          },
        }),
      }
    : {}),
  trustedOrigins: [
    ...appOrigins,
    ...(isProduction() ? [] : ["http://localhost:3000", "http://0.0.0.0:3000"]),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  socialProviders,
});

export function getConfiguredAuthOptions() {
  return {
    google: Boolean(googleClientId && googleClientSecret),
    github: Boolean(githubClientId && githubClientSecret),
    emailPassword: true,
  };
}

export type Auth = typeof auth;
