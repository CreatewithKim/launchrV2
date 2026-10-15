import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getAppOrigins, getMissingProductionConfig } from "./_core/config";

type TestUser = NonNullable<TrpcContext["user"]>;

function makeUser(id: number, role: TestUser["role"] = "user"): TestUser {
  return {
    id,
    openId: `isolation-user-${id}`,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    loginMethod: "test",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function callerFor(user: TestUser | null) {
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

const customer = (name: string) => ({
  fullName: name,
  phone: "+254700000001",
  industry: "Retail",
  segment: "New" as const,
  orderCount: 0,
  lifetimeSpendCents: 0,
});

describe("F1: unauthenticated requests are rejected", () => {
  it("rejects protected procedures when there is no user", async () => {
    const anon = callerFor(null);
    await expect(anon.launchr.customers.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.launchr.profile.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.launchr.settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.launchr.clearWorkspace()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.launchr.ai.speak({ text: "hi" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("auth.me returns null for a logged-out visitor", async () => {
    await expect(callerFor(null).auth.me()).resolves.toBeNull();
  });

  it("does not let a regular user call admin-only procedures", async () => {
    await expect(callerFor(makeUser(50)).system.notifyOwner({ title: "t", content: "c" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("F5/F7: tenant isolation and no seeded data", () => {
  it("a new user sees no seeded profile, settings, or conversations", async () => {
    const fresh = callerFor(makeUser(7001));
    await expect(fresh.launchr.settings.get()).resolves.toBeNull();
    const profile = await fresh.launchr.profile.get();
    expect(profile).toMatchObject({ fullName: "User 7001", email: "user7001@example.com" });
    await expect(fresh.launchr.conversations.list()).resolves.toEqual([]);
    expect(JSON.stringify(profile)).not.toContain("kimanzi");
  });

  it("user B cannot read, update, or delete user A's customer", async () => {
    const a = callerFor(makeUser(7101));
    const b = callerFor(makeUser(7102));
    const created = await a.launchr.customers.create(customer("Alice Customer"));

    expect((await b.launchr.customers.list()).map(c => c.id)).not.toContain(created.id);
    await expect(b.launchr.customers.update({ id: created.id, fullName: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await b.launchr.customers.remove({ id: created.id });

    const stillThere = (await a.launchr.customers.list()).find(c => c.id === created.id);
    expect(stillThere?.fullName).toBe("Alice Customer");
  });

  it("user B cannot delete user A's offer", async () => {
    const a = callerFor(makeUser(7111));
    const b = callerFor(makeUser(7112));
    const offer = await a.launchr.offers.create({
      title: "A's offer", description: "d", type: "Discount", cta: "Buy",
      startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000), status: "Active",
    });
    await expect(b.launchr.offers.remove({ id: offer.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await a.launchr.offers.list()).some(o => o.id === offer.id)).toBe(true);
  });
});

describe("F2: clearWorkspace only affects the caller", () => {
  it("leaves another user's data untouched", async () => {
    const a = callerFor(makeUser(7201));
    const b = callerFor(makeUser(7202));
    await a.launchr.customers.create(customer("A1"));
    await b.launchr.customers.create(customer("B1"));

    await a.launchr.clearWorkspace();

    expect(await a.launchr.customers.list()).toHaveLength(0);
    expect((await b.launchr.customers.list()).map(c => c.fullName)).toEqual(["B1"]);
  });
});

describe("F4/F8: production configuration guard", () => {
  it("reports nothing outside production", () => {
    expect(getMissingProductionConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("requires the database and auth secrets in production", () => {
    const missing = getMissingProductionConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(missing).toEqual(expect.arrayContaining(["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"]));
  });

  it("rejects a short auth secret", () => {
    const missing = getMissingProductionConfig({
      NODE_ENV: "production", DATABASE_URL: "mysql://x", BETTER_AUTH_URL: "https://x.app", BETTER_AUTH_SECRET: "short",
    } as unknown as NodeJS.ProcessEnv);
    expect(missing.join(" ")).toContain("at least 32");
  });

  it("passes with a complete production configuration", () => {
    expect(getMissingProductionConfig({
      NODE_ENV: "production", DATABASE_URL: "mysql://x", BETTER_AUTH_URL: "https://x.app", BETTER_AUTH_SECRET: "a".repeat(40),
    } as unknown as NodeJS.ProcessEnv)).toEqual([]);
  });
});

describe("Vercel preview deployments", () => {
  const previewEnv = {
    NODE_ENV: "production", VERCEL_ENV: "preview",
    VERCEL_URL: "launchr-abc123.vercel.app", VERCEL_BRANCH_URL: "launchr-git-feature-x.vercel.app",
    DATABASE_URL: "mysql://x", BETTER_AUTH_SECRET: "a".repeat(40),
  } as unknown as NodeJS.ProcessEnv;

  it("derives the origins from the preview URLs when BETTER_AUTH_URL is unset", () => {
    expect(getAppOrigins(previewEnv)).toEqual(["https://launchr-abc123.vercel.app", "https://launchr-git-feature-x.vercel.app"]);
    expect(getMissingProductionConfig(previewEnv)).toEqual([]);
  });

  it("still requires BETTER_AUTH_URL on production deployments", () => {
    const prod = { ...previewEnv, VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv;
    expect(getMissingProductionConfig(prod)).toContain("BETTER_AUTH_URL");
    expect(getAppOrigins(prod)).toEqual([]);
  });

  it("BETTER_AUTH_URL wins and loses its trailing slash", () => {
    const env = { ...previewEnv, BETTER_AUTH_URL: "https://app.launchr.example/" } as unknown as NodeJS.ProcessEnv;
    expect(getAppOrigins(env)).toEqual(["https://app.launchr.example"]);
  });
});
