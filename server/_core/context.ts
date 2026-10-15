import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";
import type { User } from "../../drizzle/schema";
import { auth } from "../auth";
import { getUserByOpenId, upsertUser } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. BetterAuth session. Only the session lookup is allowed to fail quietly
  //    (no/invalid cookie = logged out). Database errors below are NOT swallowed,
  //    so an outage surfaces as a server error instead of looking like "logged out".
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({
      headers: fromNodeHeaders(opts.req.headers),
    });
  } catch (_error) {
    session = null;
  }

  if (session?.user) {
    const openId = `better-auth_${session.user.id}`;
    let existingUser = await getUserByOpenId(openId);
    if (!existingUser) {
      await upsertUser({
        openId,
        name: session.user.name || "Launchr User",
        email: session.user.email || null,
        loginMethod: "better-auth",
        // New accounts are regular users. Admin is granted only via OWNER_OPEN_ID
        // or by an explicit database update, never automatically.
        role: "user",
        lastSignedIn: new Date(),
      });
      existingUser = await getUserByOpenId(openId);
    }
    if (existingUser) {
      user = existingUser;
    }
  }

  // 2. Fallback to legacy SDK auth if BetterAuth session is not active
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (_error) {
      user = null;
    }
  }

  // No session: the request stays unauthenticated (user = null). protectedProcedure
  // rejects it with UNAUTHORIZED; only publicProcedure endpoints are reachable.

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

