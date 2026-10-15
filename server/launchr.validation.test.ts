import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { scheduleIsValid, summarizeDashboard } from "./launchrDomain";

function createContext(): TrpcContext {
  return {
    user: {
      id: 999999,
      openId: "launchr-test-user",
      name: "Launchr Test",
      email: "test@launchr.local",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("launchr validation", () => {
  it("returns null instead of undefined when a user has not saved business settings", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.settings.get()).resolves.toBeNull();
  });

  it("summarizes active campaigns, message metrics, and conversion rate", () => {
    expect(summarizeDashboard({
      customerCount: 12,
      campaigns: [{ status: "Active" }, { status: "Scheduled" }, { status: "Active" }],
      metrics: [{ sentCount: 600, leadCount: 24 }, null, { sentCount: 300, leadCount: 12 }],
      leads: [{ status: "Converted" }, { status: "New" }, { status: "Converted" }, { status: "Lost" }],
    })).toEqual({ totalCustomers: 12, activeCampaigns: 2, messagesSent: 900, leadsGenerated: 36, conversionRate: 50 });
  });

  it("returns a zero conversion rate when no leads exist", () => {
    expect(summarizeDashboard({ customerCount: 0, campaigns: [], metrics: [], leads: [] }).conversionRate).toBe(0);
  });

  it("accepts immediate delivery and requires a valid scheduled timestamp", () => {
    expect(scheduleIsValid("now")).toBe(true);
    expect(scheduleIsValid("schedule")).toBe(false);
    expect(scheduleIsValid("schedule", new Date("2026-09-01T09:00:00Z"))).toBe(true);
  });

  it("rejects an offer that ends before it starts", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.offers.create({
      title: "Invalid timing",
      description: "This must be rejected before persistence.",
      type: "Percentage off",
      cta: "Open offer",
      imageUrl: "",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2026-08-31T00:00:00Z"),
      status: "Draft",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a delivery date for a scheduled campaign", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.campaigns.create({
      offerId: 1,
      name: "Scheduled without a time",
      audienceSegment: "VIP",
      mode: "schedule",
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "A schedule date is required." });
  });

  it("rejects an empty customer CSV before attempting to save an import", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.customers.importCsv({
      fileName: "customers.csv",
      content: "",
      defaultIndustry: "Retail",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a personal name before saving a personal profile", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.profile.save({
      fullName: "",
      email: "profile@example.com",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("falls back to the signed-in user details when no personal profile has been saved", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.profile.get()).resolves.toMatchObject({
      fullName: "Launchr Test",
      email: "test@launchr.local",
      phone: "",
      jobTitle: "",
    });
  });

  it("allows only supported image formats for offer image uploads", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.launchr.offers.uploadImage({
      fileName: "offer.gif",
      contentType: "image/gif" as never,
      base64: "aGVsbG8=",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
