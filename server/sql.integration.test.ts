/**
 * Integration tests against a REAL MySQL/MariaDB database.
 * Skipped unless TEST_DATABASE_URL is set (migrations must already be applied):
 *   TEST_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/launchr_test npx vitest run server/sql.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
const suite = TEST_DB ? describe : describe.skip;

const PASSWORD = "correct-horse-battery-9";
const run = Date.now();

async function load() {
  vi.resetModules();
  process.env.DATABASE_URL = TEST_DB!;
  process.env.BETTER_AUTH_SECRET = "x".repeat(48);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  const [{ auth }, ctxMod, routers, sqlMod, orm, schema, dbMod] = await Promise.all([
    import("./auth"),
    import("./_core/context"),
    import("./routers"),
    import("./_core/sqlClient"),
    import("drizzle-orm"),
    import("../drizzle/schema"),
    import("./db"),
  ]);
  return { auth, createContext: ctxMod.createContext, appRouter: routers.appRouter, db: sqlMod.getSqlClient()!, sql: orm.sql, schema, orm, dbMod };
}

async function signUp(m: Awaited<ReturnType<typeof load>>, label: string) {
  const email = `${label}-${run}@example.com`;
  const res = await m.auth.api.signUpEmail({ body: { email, password: PASSWORD, name: `Tester ${label}` }, returnHeaders: true });
  const cookie = (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[^;,]+=)/).map(c => c.split(";")[0].trim()).join("; ");
  return { email, cookie };
}

async function ctxFor(m: Awaited<ReturnType<typeof load>>, cookie: string) {
  return m.createContext({ req: { headers: cookie ? { cookie } : {} }, res: {} } as never);
}

async function count(m: Awaited<ReturnType<typeof load>>, table: string, where = "1=1") {
  const [rows] = (await m.db.execute(m.sql.raw(`SELECT COUNT(*) AS c FROM \`${table}\` WHERE ${where}`))) as unknown as [Array<{ c: number }>];
  return Number(rows[0].c);
}

suite("SQL mode (real database)", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => { m = await load(); });
  afterAll(() => { delete process.env.DATABASE_URL; });

  it("F3: sign-up persists to MySQL and survives a simulated cold start", async () => {
    const { email } = await signUp(m, "persist");
    expect(await count(m, "user", `email='${email}'`)).toBe(1);
    expect(await count(m, "session", `userId=(SELECT id FROM \`user\` WHERE email='${email}')`)).toBe(1);

    // New module instance == new serverless container with empty memory.
    const cold = await load();
    const signedIn = await cold.auth.api.signInEmail({ body: { email, password: PASSWORD } });
    expect(signedIn.user.email).toBe(email);
  });

  it("F8: passwords shorter than 10 characters are rejected", async () => {
    await expect(m.auth.api.signUpEmail({ body: { email: `short-${run}@example.com`, password: "short123", name: "Short" } })).rejects.toBeTruthy();
  });

  it("F1: no cookie = no user; with a session the user is a regular (non-admin) user", async () => {
    expect((await ctxFor(m, "")).user).toBeNull();
    const { cookie } = await signUp(m, "role");
    const ctx = await ctxFor(m, cookie);
    expect(ctx.user).not.toBeNull();
    expect(ctx.user!.role).toBe("user");
    expect(ctx.user!.email).toContain("role-");
  });

  it("F1: anonymous callers cannot reach protected data over the real router", async () => {
    const anon = m.appRouter.createCaller(await ctxFor(m, ""));
    await expect(anon.launchr.customers.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("F2: clearWorkspace deletes only the caller's rows (incl. child tables)", async () => {
    const a = await signUp(m, "tenantA");
    const b = await signUp(m, "tenantB");
    const callerA = m.appRouter.createCaller(await ctxFor(m, a.cookie));
    const callerB = m.appRouter.createCaller(await ctxFor(m, b.cookie));

    for (const caller of [callerA, callerB]) {
      const offer = await caller.launchr.offers.create({
        title: "Offer", description: "d", type: "Discount", cta: "Go", status: "Active",
        startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000),
      });
      await caller.launchr.campaigns.create({ offerId: offer.id, name: "Camp", audienceSegment: "New", mode: "now" });
      await caller.launchr.customers.importCsv({
        fileName: "c.csv", defaultIndustry: "Retail",
        content: "Name,Email,Phone,Industry,Segment\nAmina,amina@example.com,+254700000001,Retail,VIP\nTheo,theo@example.com,+254700000002,Retail,New\n",
      });
    }

    const before = {
      metrics: await count(m, "campaignMetrics"),
      importRows: await count(m, "customerImportRows"),
    };
    await callerA.launchr.clearWorkspace();

    // Tenant B's data is fully intact, including the child rows the old code deleted.
    expect(await callerB.launchr.customers.list()).toHaveLength(2);
    expect(await callerB.launchr.offers.list()).toHaveLength(1);
    expect(await callerB.launchr.campaigns.list()).toHaveLength(1);
    expect(await count(m, "campaignMetrics")).toBe(before.metrics - 1);
    expect(await count(m, "customerImportRows")).toBe(before.importRows - 2);
    // Tenant A is empty.
    expect(await callerA.launchr.customers.list()).toHaveLength(0);
    expect(await callerA.launchr.campaigns.list()).toHaveLength(0);
  });

  it("F5: user B cannot touch user A's records in SQL mode", async () => {
    const a = await signUp(m, "ownerA");
    const b = await signUp(m, "ownerB");
    const callerA = m.appRouter.createCaller(await ctxFor(m, a.cookie));
    const callerB = m.appRouter.createCaller(await ctxFor(m, b.cookie));
    const created = await callerA.launchr.customers.create({
      fullName: "Private Person", phone: "+254700000009", industry: "Retail", segment: "New", orderCount: 0, lifetimeSpendCents: 0,
    });
    expect(await callerB.launchr.customers.list()).toHaveLength(0);
    await expect(callerB.launchr.customers.update({ id: created.id, fullName: "Hacked" })).rejects.toBeTruthy();
    await callerB.launchr.customers.remove({ id: created.id });
    expect((await callerA.launchr.customers.list())[0]?.fullName).toBe("Private Person");
  });
});

describe("F4: production never falls back to the in-memory store", () => {
  const original = { ...process.env };
  afterAll(() => { process.env = original; vi.resetModules(); });

  it("throws when DATABASE_URL is missing in production", async () => {
    vi.resetModules();
    process.env = { ...original, NODE_ENV: "production" };
    delete process.env.DATABASE_URL;
    const db = await import("./db");
    await expect(db.listCustomers(1)).rejects.toThrow(/DATABASE_URL/);
  });

  it("throws (does not silently use memory) when the database is unreachable in production", async () => {
    vi.resetModules();
    process.env = { ...original, NODE_ENV: "production", DATABASE_URL: "mysql://nobody:nopass@127.0.0.1:1/none" };
    const db = await import("./db");
    await expect(db.listCustomers(1)).rejects.toThrow(/unreachable|ECONNREFUSED|schema/i);
  });
});
