import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const customerSegments = ["VIP", "Frequent Buyer", "Inactive", "New"] as const;
export const offerStatuses = ["Draft", "Active", "Expired"] as const;
export const campaignStatuses = ["Draft", "Scheduled", "Active", "Complete"] as const;
export const leadStatuses = ["New", "Contacted", "Converted", "Lost"] as const;
export const customerImportRowStatuses = ["Imported", "Skipped"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }).notNull(),
  industry: varchar("industry", { length: 120 }).notNull().default("Unspecified"),
  segment: mysqlEnum("segment", customerSegments).notNull().default("New"),
  orderCount: int("orderCount").notNull().default(0),
  lifetimeSpendCents: int("lifetimeSpendCents").notNull().default(0),
  lastActiveAt: timestamp("lastActiveAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("customers_owner_segment_idx").on(table.ownerId, table.segment), index("customers_owner_industry_idx").on(table.ownerId, table.industry)]);

export const customerImports = mysqlTable("customerImports", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 180 }).notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  totalRows: int("totalRows").notNull().default(0),
  importedRows: int("importedRows").notNull().default(0),
  skippedRows: int("skippedRows").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("customer_imports_owner_created_idx").on(table.ownerId, table.createdAt)]);

export const customerImportRows = mysqlTable("customerImportRows", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull().references(() => customerImports.id, { onDelete: "cascade" }),
  rowNumber: int("rowNumber").notNull(),
  fullName: varchar("fullName", { length: 160 }).notNull().default(""),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  industry: varchar("industry", { length: 120 }).notNull().default("Unspecified"),
  segment: mysqlEnum("segment", customerSegments).notNull().default("New"),
  rowStatus: mysqlEnum("rowStatus", customerImportRowStatuses).notNull(),
  skipReason: varchar("skipReason", { length: 200 }),
}, table => [index("customer_import_rows_import_idx").on(table.importId, table.rowNumber)]);

export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 80 }).notNull(),
  imageUrl: text("imageUrl"),
  cta: varchar("cta", { length: 120 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("status", offerStatuses).notNull().default("Draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("offers_owner_status_idx").on(table.ownerId, table.status)]);

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  offerId: int("offerId").notNull().references(() => offers.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  audienceSegment: mysqlEnum("audienceSegment", customerSegments).notNull(),
  status: mysqlEnum("status", campaignStatuses).notNull().default("Draft"),
  scheduledAt: timestamp("scheduledAt"),
  launchedAt: timestamp("launchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("campaigns_owner_status_idx").on(table.ownerId, table.status), index("campaigns_offer_idx").on(table.offerId)]);

export const campaignMetrics = mysqlTable("campaignMetrics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  sentCount: int("sentCount").notNull().default(0),
  deliveredCount: int("deliveredCount").notNull().default(0),
  readCount: int("readCount").notNull().default(0),
  replyCount: int("replyCount").notNull().default(0),
  leadCount: int("leadCount").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("campaign_metrics_campaign_idx").on(table.campaignId)]);

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  source: varchar("source", { length: 180 }).notNull(),
  status: mysqlEnum("status", leadStatuses).notNull().default("New"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("leads_owner_status_idx").on(table.ownerId, table.status), index("leads_campaign_idx").on(table.campaignId)]);

export const businessSettings = mysqlTable("businessSettings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  businessName: varchar("businessName", { length: 160 }).notNull(),
  businessType: varchar("businessType", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  whatsappNumber: varchar("whatsappNumber", { length: 40 }),
  email: varchar("email", { length: 320 }),
  logoUrl: text("logoUrl"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("business_settings_owner_idx").on(table.ownerId)]);

export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  jobTitle: varchar("jobTitle", { length: 120 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("user_profiles_owner_idx").on(table.ownerId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type CustomerImport = typeof customerImports.$inferSelect;
export type CustomerImportRow = typeof customerImportRows.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type BusinessSettings = typeof businessSettings.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;

// ---------------------------------------------------------------------------
// BetterAuth tables (users, sessions, OAuth accounts, verification tokens).
// Kept separate from the app-level `users` table, which is linked by openId
// (`better-auth_<id>`) when a session is first resolved.
// ---------------------------------------------------------------------------
export const baUser = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const baSession = mysqlTable("session", {
  id: varchar("id", { length: 36 }).primaryKey(),
  expiresAt: timestamp("expiresAt", { fsp: 3 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: varchar("userId", { length: 36 }).notNull().references(() => baUser.id, { onDelete: "cascade" }),
}, table => [index("session_user_idx").on(table.userId)]);

export const baAccount = mysqlTable("account", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: varchar("userId", { length: 36 }).notNull().references(() => baUser.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { fsp: 3 }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { fsp: 3 }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, table => [index("account_user_idx").on(table.userId)]);

export const baVerification = mysqlTable("verification", {
  id: varchar("id", { length: 36 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { fsp: 3 }).notNull(),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, table => [index("verification_identifier_idx").on(table.identifier)]);
