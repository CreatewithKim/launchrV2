import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  businessSettings,
  campaignMetrics,
  campaigns,
  customerImportRows,
  customerImports,
  customers,
  customerSegments,
  InsertUser,
  leads,
  offers,
  userProfiles,
  users,
  type BusinessSettings,
  type Campaign,
  type Customer,
  type CustomerImport,
  type CustomerImportRow,
  type Lead,
  type Offer,
  type User,
  type UserProfile,
} from "../drizzle/schema";
import { isProduction } from "./_core/config";
import { ENV } from "./_core/env";
import { getSqlClient } from "./_core/sqlClient";
import { summarizeDashboard } from "./launchrDomain";
import type { ParsedCustomerImportRow } from "./customerImport";

let database: ReturnType<typeof drizzle> | null = null;
let dbCheckDone = false;

/**
 * Returns the SQL database, or null when running locally without DATABASE_URL.
 *
 * In production there is NO silent in-memory fallback: a missing or unreachable
 * database throws, so the request fails visibly instead of quietly losing data.
 * The in-memory store exists for local development and tests only.
 */
export async function getDb(): Promise<ReturnType<typeof drizzle> | null> {
  if (dbCheckDone) {
    return database;
  }

  const inst = getSqlClient();
  if (!inst) {
    if (isProduction()) {
      throw new Error("[Database] DATABASE_URL is not set. Refusing to use the in-memory store in production.");
    }
    dbCheckDone = true;
    database = null;
    return database;
  }

  try {
    // Quick probe to verify credentials and that migrations have been applied
    await Promise.race([
      inst.select().from(users).limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection probe timed out")), isProduction() ? 8000 : 2000)),
    ]);
    database = inst;
    dbCheckDone = true;
    console.log("[Database] Connected successfully to SQL database.");
  } catch (error) {
    if (isProduction()) {
      // Do not cache the failure: the next request retries (cold start, brief outage).
      throw new Error(`[Database] SQL database unreachable or schema missing: ${(error as Error)?.message || error}`);
    }
    console.warn(
      "[Database] SQL database unreachable or unverified; using the in-memory store (development only):",
      (error as Error)?.message || error
    );
    dbCheckDone = true;
    database = null;
  }
  return database;
}

/** Central handler for SQL errors: fail loudly in production, fall back to memory in development. */
function handleSqlFailure(operation: string, err: unknown): void {
  if (isProduction()) {
    console.error(`[Database] ${operation} SQL failed:`, (err as Error)?.message || err);
    throw err;
  }
  console.warn(`[Database] ${operation} SQL failed, using in-memory store (development only):`, (err as Error)?.message || err);
  database = null;
}

// ---------------------------------------------------------------------------
// In-memory data store for live workspace
// ---------------------------------------------------------------------------

let nextId = 200;
function genId(): number {
  return ++nextId;
}

const memoryUsers: User[] = [];

let memoryCustomers: Customer[] = [];
let memoryOffers: Offer[] = [];
let memoryCampaigns: Campaign[] = [];
let memoryCampaignMetrics: (typeof campaignMetrics.$inferSelect)[] = [];
let memoryLeads: Lead[] = [];
let memoryCustomerImports: CustomerImport[] = [];
let memoryCustomerImportRows: CustomerImportRow[] = [];

const memoryBusinessSettings: BusinessSettings[] = [];

const memoryUserProfiles: UserProfile[] = [];

export async function clearWorkspaceData(ownerId: number): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      // Only rows owned by this user are touched. Child rows (campaignMetrics,
      // customerImportRows) are removed by their ON DELETE CASCADE foreign keys
      // when their owned parent is deleted, so no unscoped delete is needed.
      await db.transaction(async tx => {
        await tx.delete(customerImports).where(eq(customerImports.ownerId, ownerId));
        await tx.delete(campaigns).where(eq(campaigns.ownerId, ownerId));
        await tx.delete(leads).where(eq(leads.ownerId, ownerId));
        await tx.delete(customers).where(eq(customers.ownerId, ownerId));
        await tx.delete(offers).where(eq(offers.ownerId, ownerId));
      });
      return { success: true };
    } catch (err) {
      handleSqlFailure("clearWorkspaceData", err);
    }
  }

  // In-memory (development/test only): remove just this owner's records.
  const ownedImportIds = new Set(memoryCustomerImports.filter(ci => ci.ownerId === ownerId).map(ci => ci.id));
  const ownedCampaignIds = new Set(memoryCampaigns.filter(c => c.ownerId === ownerId).map(c => c.id));
  memoryCustomerImportRows = memoryCustomerImportRows.filter(row => !ownedImportIds.has(row.importId));
  memoryCustomerImports = memoryCustomerImports.filter(ci => ci.ownerId !== ownerId);
  memoryCampaignMetrics = memoryCampaignMetrics.filter(m => !ownedCampaignIds.has(m.campaignId));
  memoryCampaigns = memoryCampaigns.filter(c => c.ownerId !== ownerId);
  memoryLeads = memoryLeads.filter(l => l.ownerId !== ownerId);
  memoryCustomers = memoryCustomers.filter(c => c.ownerId !== ownerId);
  memoryOffers = memoryOffers.filter(o => o.ownerId !== ownerId);

  return { success: true };
}

// Helper to normalize queries across SQL and in-memory fallback
function findUserByAnyId(openId: string): User | undefined {
  return memoryUsers.find(u => u.openId === openId || String(u.id) === openId);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    try {
      const values: InsertUser = { ...user, lastSignedIn: user.lastSignedIn ?? new Date() };
      const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
      (["name", "email", "loginMethod", "role"] as const).forEach(field => {
        if (user[field] !== undefined) updateSet[field] = user[field] ?? null;
      });
      if (!user.role && user.openId === ENV.ownerOpenId) updateSet.role = "admin";
      await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
      return;
    } catch (err) {
      handleSqlFailure("upsertUser", err);
    }
  }

  const existing = memoryUsers.find(u => u.openId === user.openId);
  if (existing) {
    if (user.name !== undefined) existing.name = user.name;
    if (user.email !== undefined) existing.email = user.email;
    if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod;
    if (user.role !== undefined) existing.role = user.role;
    existing.lastSignedIn = user.lastSignedIn ?? new Date();
    existing.updatedAt = new Date();
  } else {
    memoryUsers.push({
      id: genId(),
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (result[0]) return result[0];
    } catch (err) {
      handleSqlFailure("getUserByOpenId", err);
    }
  }
  return findUserByAnyId(openId);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function listCustomers(ownerId: number, segment?: (typeof customers.segment.enumValues)[number]): Promise<Customer[]> {
  const db = await getDb();
  if (db) {
    try {
      const where = segment ? and(eq(customers.ownerId, ownerId), eq(customers.segment, segment)) : eq(customers.ownerId, ownerId);
      return await db.select().from(customers).where(where).orderBy(desc(customers.createdAt));
    } catch (err) {
      handleSqlFailure("listCustomers", err);
    }
  }
  return memoryCustomers
    .filter(c => c.ownerId === ownerId && (!segment || c.segment === segment))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createCustomer(ownerId: number, input: {
  fullName: string;
  email?: string | null;
  phone: string;
  industry: string;
  segment: (typeof customerSegments)[number];
  orderCount: number;
  lifetimeSpendCents: number;
  lastActiveAt?: Date | null;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.insert(customers).values({
        ...input,
        ownerId,
        email: input.email || null,
        lastActiveAt: input.lastActiveAt ?? null,
      });
      return { id: result[0].insertId };
    } catch (err) {
      handleSqlFailure("createCustomer", err);
    }
  }

  const id = genId();
  const newCustomer: Customer = {
    id,
    ownerId,
    fullName: input.fullName,
    email: input.email || null,
    phone: input.phone,
    industry: input.industry,
    segment: input.segment,
    orderCount: input.orderCount ?? 0,
    lifetimeSpendCents: input.lifetimeSpendCents ?? 0,
    lastActiveAt: input.lastActiveAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryCustomers.unshift(newCustomer);
  return { id };
}

export async function updateCustomer(ownerId: number, id: number, changes: Partial<{
  fullName: string;
  email: string | null;
  phone: string;
  industry: string;
  segment: (typeof customerSegments)[number];
  orderCount: number;
  lifetimeSpendCents: number;
  lastActiveAt: Date | null;
}>): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.update(customers).set({
        ...changes,
        ...(changes.email === "" ? { email: null } : {}),
      }).where(and(eq(customers.id, id), eq(customers.ownerId, ownerId)));
      if (result[0].affectedRows) return { success: true };
    } catch (err) {
      handleSqlFailure("updateCustomer", err);
    }
  }

  const target = memoryCustomers.find(c => c.id === id && c.ownerId === ownerId);
  if (!target) throw new Error("Customer not found.");
  Object.assign(target, changes, {
    email: changes.email === "" ? null : (changes.email ?? target.email),
    updatedAt: new Date(),
  });
  return { success: true };
}

export async function deleteCustomer(ownerId: number, id: number): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      await db.delete(customers).where(and(eq(customers.id, id), eq(customers.ownerId, ownerId)));
      return { success: true };
    } catch (err) {
      handleSqlFailure("deleteCustomer", err);
    }
  }

  const index = memoryCustomers.findIndex(c => c.id === id && c.ownerId === ownerId);
  if (index !== -1) {
    memoryCustomers.splice(index, 1);
  }
  return { success: true };
}

export async function importCustomerCsvData(
  ownerId: number,
  input: {
    fileName: string;
    sourceUrl: string;
    parsedRows: ParsedCustomerImportRow[];
  },
): Promise<{ id: number; totalRows: number; importedRows: number; skippedRows: number }> {
  const validRows = input.parsedRows.filter(row => row.fullName && row.phone);
  const skippedRows = input.parsedRows.length - validRows.length;
  const db = await getDb();

  if (db) {
    try {
      const created = await db.insert(customerImports).values({
        ownerId,
        fileName: input.fileName,
        sourceUrl: input.sourceUrl,
        totalRows: input.parsedRows.length,
        importedRows: validRows.length,
        skippedRows,
      });
      const importId = created[0].insertId;

      if (validRows.length) {
        await db.insert(customers).values(
          validRows.map(row => ({
            ownerId,
            fullName: row.fullName,
            email: row.email || null,
            phone: row.phone,
            industry: row.industry,
            segment: row.segment,
            orderCount: 0,
            lifetimeSpendCents: 0,
          })),
        );
      }

      await db.insert(customerImportRows).values(
        input.parsedRows.map(row => {
          const imported = Boolean(row.fullName && row.phone);
          const rowStatus: "Imported" | "Skipped" = imported ? "Imported" : "Skipped";
          return {
            importId,
            rowNumber: row.rowNumber,
            fullName: row.fullName,
            email: row.email || null,
            phone: row.phone,
            industry: row.industry,
            segment: row.segment,
            rowStatus,
            skipReason: imported ? null : !row.fullName ? "Missing customer name" : "Missing phone number",
          };
        }),
      );

      return { id: importId, totalRows: input.parsedRows.length, importedRows: validRows.length, skippedRows };
    } catch (err) {
      handleSqlFailure("importCustomerCsvData", err);
    }
  }

  const importId = genId();
  memoryCustomerImports.unshift({
    id: importId,
    ownerId,
    fileName: input.fileName,
    sourceUrl: input.sourceUrl,
    totalRows: input.parsedRows.length,
    importedRows: validRows.length,
    skippedRows,
    createdAt: new Date(),
  });

  for (const row of validRows) {
    memoryCustomers.unshift({
      id: genId(),
      ownerId,
      fullName: row.fullName,
      email: row.email || null,
      phone: row.phone,
      industry: row.industry,
      segment: row.segment,
      orderCount: 0,
      lifetimeSpendCents: 0,
      lastActiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  for (const row of input.parsedRows) {
    const imported = Boolean(row.fullName && row.phone);
    memoryCustomerImportRows.push({
      id: genId(),
      importId,
      rowNumber: row.rowNumber,
      fullName: row.fullName,
      email: row.email || null,
      phone: row.phone,
      industry: row.industry,
      segment: row.segment,
      rowStatus: imported ? "Imported" : "Skipped",
      skipReason: imported ? null : !row.fullName ? "Missing customer name" : "Missing phone number",
    });
  }

  return { id: importId, totalRows: input.parsedRows.length, importedRows: validRows.length, skippedRows };
}

export async function listCustomerImports(ownerId: number): Promise<CustomerImport[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(customerImports).where(eq(customerImports.ownerId, ownerId)).orderBy(desc(customerImports.createdAt));
    } catch (err) {
      handleSqlFailure("listCustomerImports", err);
    }
  }
  return memoryCustomerImports
    .filter(ci => ci.ownerId === ownerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getCustomerImport(ownerId: number, importId: number): Promise<{ record: CustomerImport; rows: CustomerImportRow[] } | null> {
  const db = await getDb();
  if (db) {
    try {
      const record = await db.select().from(customerImports).where(and(eq(customerImports.ownerId, ownerId), eq(customerImports.id, importId))).limit(1);
      if (record[0]) {
        const rows = await db.select().from(customerImportRows).where(eq(customerImportRows.importId, importId)).orderBy(asc(customerImportRows.rowNumber));
        return { record: record[0], rows };
      }
    } catch (err) {
      handleSqlFailure("getCustomerImport", err);
    }
  }

  const record = memoryCustomerImports.find(ci => ci.id === importId && ci.ownerId === ownerId);
  if (!record) return null;
  const rows = memoryCustomerImportRows
    .filter(r => r.importId === importId)
    .sort((a, b) => a.rowNumber - b.rowNumber);
  return { record, rows };
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export async function listOffers(ownerId: number): Promise<Offer[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(offers).where(eq(offers.ownerId, ownerId)).orderBy(desc(offers.createdAt));
    } catch (err) {
      handleSqlFailure("listOffers", err);
    }
  }
  return memoryOffers
    .filter(o => o.ownerId === ownerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createOffer(ownerId: number, input: {
  title: string;
  description: string;
  type: string;
  imageUrl?: string | null;
  cta: string;
  startsAt: Date;
  endsAt: Date;
  status: "Draft" | "Active" | "Expired";
}): Promise<{ id: number }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.insert(offers).values({
        ...input,
        ownerId,
        imageUrl: input.imageUrl || null,
      });
      return { id: result[0].insertId };
    } catch (err) {
      handleSqlFailure("createOffer", err);
    }
  }

  const id = genId();
  const newOffer: Offer = {
    id,
    ownerId,
    title: input.title,
    description: input.description,
    type: input.type,
    imageUrl: input.imageUrl || null,
    cta: input.cta,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryOffers.unshift(newOffer);
  return { id };
}

export async function updateOfferStatus(ownerId: number, id: number, status: "Draft" | "Active" | "Expired"): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      await db.update(offers).set({ status }).where(and(eq(offers.id, id), eq(offers.ownerId, ownerId)));
      return { success: true };
    } catch (err) {
      handleSqlFailure("updateOfferStatus", err);
    }
  }

  const offer = memoryOffers.find(o => o.id === id && o.ownerId === ownerId);
  if (!offer) throw new Error("Offer not found.");
  offer.status = status;
  offer.updatedAt = new Date();
  return { success: true };
}

export async function deleteOffer(ownerId: number, id: number): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.delete(offers).where(and(eq(offers.id, id), eq(offers.ownerId, ownerId)));
      if (result[0].affectedRows) return { success: true };
    } catch (err) {
      handleSqlFailure("deleteOffer", err);
    }
  }

  const index = memoryOffers.findIndex(o => o.id === id && o.ownerId === ownerId);
  if (index === -1) throw new Error("Offer not found.");
  memoryOffers.splice(index, 1);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function listCampaigns(ownerId: number): Promise<Campaign[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(campaigns).where(eq(campaigns.ownerId, ownerId)).orderBy(desc(campaigns.createdAt));
    } catch (err) {
      handleSqlFailure("listCampaigns", err);
    }
  }
  return memoryCampaigns
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createCampaign(ownerId: number, input: {
  offerId: number;
  name: string;
  audienceSegment: (typeof customerSegments)[number];
  mode: "now" | "schedule";
  scheduledAt?: Date;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (db) {
    try {
      const offered = await db.select({ id: offers.id }).from(offers).where(and(eq(offers.id, input.offerId), eq(offers.ownerId, ownerId))).limit(1);
      if (offered[0]) {
        const result = await db.insert(campaigns).values({
          ownerId,
          offerId: input.offerId,
          name: input.name,
          audienceSegment: input.audienceSegment,
          status: input.mode === "now" ? "Active" : "Scheduled",
          scheduledAt: input.mode === "schedule" ? input.scheduledAt : null,
          launchedAt: input.mode === "now" ? new Date() : null,
        });
        const campaignId = result[0].insertId;
        await db.insert(campaignMetrics).values({ campaignId });
        return { id: campaignId };
      }
    } catch (err) {
      handleSqlFailure("createCampaign", err);
    }
  }

  const campaignId = genId();
  const newCampaign: Campaign = {
    id: campaignId,
    ownerId,
    offerId: input.offerId,
    name: input.name,
    audienceSegment: input.audienceSegment,
    status: input.mode === "now" ? "Active" : "Scheduled",
    scheduledAt: input.mode === "schedule" ? (input.scheduledAt ?? null) : null,
    launchedAt: input.mode === "now" ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryCampaigns.unshift(newCampaign);

  memoryCampaignMetrics.push({
    id: genId(),
    campaignId,
    sentCount: input.mode === "now" ? 45 : 0,
    deliveredCount: input.mode === "now" ? 44 : 0,
    readCount: input.mode === "now" ? 38 : 0,
    replyCount: input.mode === "now" ? 8 : 0,
    leadCount: input.mode === "now" ? 3 : 0,
    updatedAt: new Date(),
  });

  return { id: campaignId };
}

export async function updateCampaignStatus(ownerId: number, id: number, status: "Draft" | "Scheduled" | "Active" | "Complete"): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.update(campaigns).set({
        status,
        ...(status === "Active" ? { launchedAt: new Date() } : {}),
      }).where(and(eq(campaigns.id, id), eq(campaigns.ownerId, ownerId)));
      if (result[0].affectedRows) return { success: true };
    } catch (err) {
      handleSqlFailure("updateCampaignStatus", err);
    }
  }

  const campaign = memoryCampaigns.find(c => c.id === id && c.ownerId === ownerId);
  if (!campaign) throw new Error("Campaign not found.");
  campaign.status = status;
  if (status === "Active") campaign.launchedAt = new Date();
  campaign.updatedAt = new Date();
  return { success: true };
}

export async function deleteCampaign(ownerId: number, id: number): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.ownerId, ownerId)));
      return { success: true };
    } catch (err) {
      handleSqlFailure("deleteCampaign", err);
    }
  }

  const index = memoryCampaigns.findIndex(c => c.id === id && c.ownerId === ownerId);
  if (index !== -1) {
    memoryCampaigns.splice(index, 1);
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function listLeads(ownerId: number, status?: (typeof leads.status.enumValues)[number]): Promise<Lead[]> {
  const db = await getDb();
  if (db) {
    try {
      const where = status ? and(eq(leads.ownerId, ownerId), eq(leads.status, status)) : eq(leads.ownerId, ownerId);
      return await db.select().from(leads).where(where).orderBy(desc(leads.createdAt));
    } catch (err) {
      handleSqlFailure("listLeads", err);
    }
  }
  return memoryLeads
    .filter(l => l.ownerId === ownerId && (!status || l.status === status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createLead(ownerId: number, input: {
  campaignId?: number | null;
  fullName: string;
  phone: string;
  source: string;
  status: "New" | "Contacted" | "Converted" | "Lost";
  notes?: string | null;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.insert(leads).values({
        ...input,
        ownerId,
        campaignId: input.campaignId ?? null,
        notes: input.notes ?? null,
      });
      return { id: result[0].insertId };
    } catch (err) {
      handleSqlFailure("createLead", err);
    }
  }

  const id = genId();
  const newLead: Lead = {
    id,
    ownerId,
    campaignId: input.campaignId ?? null,
    fullName: input.fullName,
    phone: input.phone,
    source: input.source,
    status: input.status,
    notes: input.notes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryLeads.unshift(newLead);
  return { id };
}

export async function updateLead(ownerId: number, id: number, changes: {
  status?: "New" | "Contacted" | "Converted" | "Lost";
  notes?: string;
}): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.update(leads).set(changes).where(and(eq(leads.id, id), eq(leads.ownerId, ownerId)));
      if (result[0].affectedRows) return { success: true };
    } catch (err) {
      handleSqlFailure("updateLead", err);
    }
  }

  const lead = memoryLeads.find(l => l.id === id && l.ownerId === ownerId);
  if (!lead) throw new Error("Lead not found.");
  if (changes.status) lead.status = changes.status;
  if (changes.notes !== undefined) lead.notes = changes.notes;
  lead.updatedAt = new Date();
  return { success: true };
}

export async function deleteLead(ownerId: number, id: number): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      await db.delete(leads).where(and(eq(leads.id, id), eq(leads.ownerId, ownerId)));
      return { success: true };
    } catch (err) {
      handleSqlFailure("deleteLead", err);
    }
  }

  const index = memoryLeads.findIndex(l => l.id === id && l.ownerId === ownerId);
  if (index !== -1) {
    memoryLeads.splice(index, 1);
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Analytics & Performance
// ---------------------------------------------------------------------------

export async function listCampaignPerformance(ownerId: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select({ campaign: campaigns, metrics: campaignMetrics, offerTitle: offers.title })
        .from(campaigns)
        .leftJoin(campaignMetrics, eq(campaignMetrics.campaignId, campaigns.id))
        .leftJoin(offers, eq(offers.id, campaigns.offerId))
        .where(eq(campaigns.ownerId, ownerId))
        .orderBy(desc(campaigns.createdAt));
    } catch (err) {
      handleSqlFailure("listCampaignPerformance", err);
    }
  }

  return memoryCampaigns
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(c => {
      const metric = memoryCampaignMetrics.find(m => m.campaignId === c.id) ?? null;
      const offer = memoryOffers.find(o => o.id === c.offerId);
      return {
        campaign: c,
        metrics: metric,
        offerTitle: offer?.title ?? "Growth Acceleration Offer",
      };
    });
}

export async function getDashboardSummary(ownerId: number) {
  const [ownerCustomers, ownerCampaigns, performance, ownerLeads] = await Promise.all([
    listCustomers(ownerId),
    listCampaigns(ownerId),
    listCampaignPerformance(ownerId),
    listLeads(ownerId),
  ]);
  return summarizeDashboard({
    customerCount: ownerCustomers.length,
    campaigns: ownerCampaigns,
    metrics: performance.map(item => item.metrics),
    leads: ownerLeads,
  });
}

// ---------------------------------------------------------------------------
// Settings & Profile
// ---------------------------------------------------------------------------

export async function getBusinessSettings(ownerId: number): Promise<BusinessSettings | null> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(businessSettings).where(eq(businessSettings.ownerId, ownerId)).limit(1);
      if (result[0]) return result[0];
    } catch (err) {
      handleSqlFailure("getBusinessSettings", err);
    }
  }
  return memoryBusinessSettings.find(bs => bs.ownerId === ownerId) ?? null;
}

export async function saveBusinessSettings(ownerId: number, input: {
  businessName: string;
  businessType: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  logoUrl?: string;
}): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      await db.insert(businessSettings).values({
        ...input,
        ownerId,
        email: input.email || null,
        logoUrl: input.logoUrl || null,
      }).onDuplicateKeyUpdate({
        set: {
          ...input,
          email: input.email || null,
          logoUrl: input.logoUrl || null,
        },
      });
      return { success: true };
    } catch (err) {
      handleSqlFailure("saveBusinessSettings", err);
    }
  }

  const existing = memoryBusinessSettings.find(bs => bs.ownerId === ownerId);
  if (existing) {
    existing.businessName = input.businessName;
    existing.businessType = input.businessType;
    existing.phone = input.phone || null;
    existing.whatsappNumber = input.whatsappNumber || null;
    existing.email = input.email || null;
    existing.logoUrl = input.logoUrl || null;
    existing.updatedAt = new Date();
  } else {
    memoryBusinessSettings.push({
      id: genId(),
      ownerId,
      businessName: input.businessName,
      businessType: input.businessType,
      phone: input.phone || null,
      whatsappNumber: input.whatsappNumber || null,
      email: input.email || null,
      logoUrl: input.logoUrl || null,
      updatedAt: new Date(),
    });
  }
  return { success: true };
}

export async function getPersonalProfile(ownerId: number): Promise<UserProfile | null> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(userProfiles).where(eq(userProfiles.ownerId, ownerId)).limit(1);
      if (result[0]) return result[0];
    } catch (err) {
      handleSqlFailure("getPersonalProfile", err);
    }
  }
  return memoryUserProfiles.find(up => up.ownerId === ownerId) ?? null;
}

export async function savePersonalProfile(ownerId: number, input: {
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
}): Promise<{ success: true }> {
  const db = await getDb();
  if (db) {
    try {
      await db.insert(userProfiles).values({
        ownerId,
        fullName: input.fullName,
        email: input.email || null,
        phone: input.phone || null,
        jobTitle: input.jobTitle || null,
      }).onDuplicateKeyUpdate({
        set: {
          fullName: input.fullName,
          email: input.email || null,
          phone: input.phone || null,
          jobTitle: input.jobTitle || null,
        },
      });
      return { success: true };
    } catch (err) {
      handleSqlFailure("savePersonalProfile", err);
    }
  }

  const existing = memoryUserProfiles.find(up => up.ownerId === ownerId);
  if (existing) {
    existing.fullName = input.fullName;
    existing.email = input.email || null;
    existing.phone = input.phone || null;
    existing.jobTitle = input.jobTitle || null;
    existing.updatedAt = new Date();
  } else {
    memoryUserProfiles.push({
      id: genId(),
      ownerId,
      fullName: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      jobTitle: input.jobTitle || null,
      updatedAt: new Date(),
    });
  }
  return { success: true };
}

export {
  businessSettings,
  campaignMetrics,
  campaigns,
  customerImportRows,
  customerImports,
  customers,
  leads,
  offers,
  userProfiles,
  users,
};
