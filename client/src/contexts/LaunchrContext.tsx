import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { createContext, useContext, useMemo } from "react";

export type Segment = "VIP" | "Frequent Buyer" | "Inactive" | "New";
export type OfferStatus = "Draft" | "Active" | "Expired";
export type CampaignStatus = "Active" | "Scheduled" | "Complete" | "Draft";
export type LeadStatus = "New" | "Contacted" | "Converted" | "Lost";

export type Customer = { id: number; name: string; email: string; phone: string; industry: string; segment: Segment; orders: number; spend: string; lastSeen: string };
export type Offer = { id: number; title: string; description: string; type: string; cta: string; startDate: string; endDate: string; status: OfferStatus; image?: string };
export type Campaign = { id: number; name: string; offerId: number; offer: string; audience: string; status: CampaignStatus; scheduledFor: string; sent: number; delivered: number; read: number; replies: number; leads: number; scheduledAt?: Date };
export type Lead = { id: number; name: string; phone: string; source: string; status: LeadStatus; note: string; created: string };
export type BusinessProfile = { name: string; type: string; phone: string; whatsapp: string; email: string; logoName: string; logoUrl?: string };
export type DashboardSummary = { totalCustomers: number; activeCampaigns: number; messagesSent: number; leadsGenerated: number; conversionRate: number };

type LaunchrContextValue = {
  customers: Customer[]; offers: Offer[]; campaigns: Campaign[]; leads: Lead[]; profile: BusinessProfile; dashboard: DashboardSummary; isPersistedWorkspace: boolean;
  addCustomer: (customer: Omit<Customer, "id">) => void; updateCustomer: (id: number, customer: Omit<Customer, "id">) => void; deleteCustomer: (id: number) => void;
  addOffer: (offer: Omit<Offer, "id">) => void; createCampaign: (campaign: Omit<Campaign, "id" | "sent" | "delivered" | "read" | "replies" | "leads">) => void;
  updateLead: (id: number, changes: Partial<Pick<Lead, "status" | "note">>) => void; setProfile: (profile: BusinessProfile) => void;
};

const LaunchrContext = createContext<LaunchrContextValue | null>(null);
const emptyProfile: BusinessProfile = { name: "", type: "", phone: "", whatsapp: "", email: "", logoName: "No logo selected", logoUrl: "" };
const emptyDashboard: DashboardSummary = { totalCustomers: 0, activeCampaigns: 0, messagesSent: 0, leadsGenerated: 0, conversionRate: 0 };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const dateText = (value: Date | null) => value ? value.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No activity";
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const cents = (value: string) => Math.round(Number(value.replace(/[^0-9.]/g, "")) * 100) || 0;

export function LaunchrProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const customersQuery = trpc.launchr.customers.list.useQuery(undefined, { enabled: isAuthenticated });
  const offersQuery = trpc.launchr.offers.list.useQuery(undefined, { enabled: isAuthenticated });
  const performanceQuery = trpc.launchr.analytics.campaignPerformance.useQuery(undefined, { enabled: isAuthenticated });
  const leadsQuery = trpc.launchr.leads.list.useQuery(undefined, { enabled: isAuthenticated });
  const settingsQuery = trpc.launchr.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const dashboardQuery = trpc.launchr.dashboard.summary.useQuery(undefined, { enabled: isAuthenticated });
  const refreshAudience = () => { void utils.launchr.customers.list.invalidate(); void utils.launchr.dashboard.summary.invalidate(); };
  const refreshOffers = () => { void utils.launchr.offers.list.invalidate(); };
  const refreshCampaigns = () => { void utils.launchr.analytics.campaignPerformance.invalidate(); void utils.launchr.dashboard.summary.invalidate(); };
  const refreshLeads = () => { void utils.launchr.leads.list.invalidate(); void utils.launchr.dashboard.summary.invalidate(); };
  const customerCreate = trpc.launchr.customers.create.useMutation({ onSuccess: refreshAudience });
  const customerUpdate = trpc.launchr.customers.update.useMutation({ onSuccess: refreshAudience });
  const customerRemove = trpc.launchr.customers.remove.useMutation({ onSuccess: refreshAudience });
  const offerCreate = trpc.launchr.offers.create.useMutation({ onSuccess: refreshOffers });
  const campaignCreate = trpc.launchr.campaigns.create.useMutation({ onSuccess: refreshCampaigns });
  const leadUpdate = trpc.launchr.leads.update.useMutation({ onSuccess: refreshLeads });
  const settingsSave = trpc.launchr.settings.save.useMutation({ onSuccess: () => void utils.launchr.settings.get.invalidate() });

  const customers: Customer[] = (isAuthenticated ? customersQuery.data ?? [] : []).map(row => ({ id: row.id, name: row.fullName, email: row.email ?? "", phone: row.phone, industry: row.industry, segment: row.segment as Segment, orders: row.orderCount, spend: money(row.lifetimeSpendCents), lastSeen: dateText(row.lastActiveAt) }));
  const offers: Offer[] = (isAuthenticated ? offersQuery.data ?? [] : []).map(row => ({ id: row.id, title: row.title, description: row.description, type: row.type, cta: row.cta, startDate: isoDate(row.startsAt), endDate: isoDate(row.endsAt), status: row.status as OfferStatus, image: row.imageUrl ?? undefined }));
  const campaigns: Campaign[] = (isAuthenticated ? performanceQuery.data ?? [] : []).map(row => ({ id: row.campaign.id, name: row.campaign.name, offerId: row.campaign.offerId, offer: row.offerTitle ?? "Offer", audience: row.campaign.audienceSegment, status: row.campaign.status as CampaignStatus, scheduledFor: row.campaign.status === "Active" ? "Live now" : row.campaign.scheduledAt ? row.campaign.scheduledAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled", sent: row.metrics?.sentCount ?? 0, delivered: row.metrics?.deliveredCount ?? 0, read: row.metrics?.readCount ?? 0, replies: row.metrics?.replyCount ?? 0, leads: row.metrics?.leadCount ?? 0, scheduledAt: row.campaign.scheduledAt ?? undefined }));
  const leads: Lead[] = (isAuthenticated ? leadsQuery.data ?? [] : []).map(row => ({ id: row.id, name: row.fullName, phone: row.phone, source: row.source, status: row.status as LeadStatus, note: row.notes ?? "", created: dateText(row.createdAt) }));
  const profile: BusinessProfile = settingsQuery.data ? { name: settingsQuery.data.businessName, type: settingsQuery.data.businessType, phone: settingsQuery.data.phone ?? "", whatsapp: settingsQuery.data.whatsappNumber ?? "", email: settingsQuery.data.email ?? "", logoName: settingsQuery.data.logoUrl?.split("/").pop() ?? "No logo selected", logoUrl: settingsQuery.data.logoUrl ?? "" } : emptyProfile;
  const dashboard = dashboardQuery.data ?? emptyDashboard;

  const value = useMemo<LaunchrContextValue>(() => ({
    customers, offers, campaigns, leads, profile, dashboard, isPersistedWorkspace: isAuthenticated,
    addCustomer: customer => { if (isAuthenticated) customerCreate.mutate({ fullName: customer.name, email: customer.email, phone: customer.phone, industry: customer.industry, segment: customer.segment, orderCount: customer.orders, lifetimeSpendCents: cents(customer.spend) }); },
    updateCustomer: (id, customer) => { if (isAuthenticated) customerUpdate.mutate({ id, fullName: customer.name, email: customer.email, phone: customer.phone, industry: customer.industry, segment: customer.segment, orderCount: customer.orders, lifetimeSpendCents: cents(customer.spend) }); },
    deleteCustomer: id => { if (isAuthenticated) customerRemove.mutate({ id }); },
    addOffer: offer => { if (isAuthenticated) offerCreate.mutate({ title: offer.title, description: offer.description, type: offer.type, imageUrl: offer.image ?? "", cta: offer.cta, startsAt: new Date(`${offer.startDate}T00:00:00`), endsAt: new Date(`${offer.endDate}T23:59:59`), status: offer.status }); },
    createCampaign: campaign => { if (isAuthenticated) campaignCreate.mutate({ offerId: campaign.offerId, name: campaign.name, audienceSegment: campaign.audience as Segment, mode: campaign.status === "Active" ? "now" : "schedule", scheduledAt: campaign.scheduledAt }); },
    updateLead: (id, changes) => { if (isAuthenticated) leadUpdate.mutate({ id, ...(changes.status ? { status: changes.status } : {}), ...(changes.note !== undefined ? { notes: changes.note } : {}) }); },
    setProfile: nextProfile => { if (isAuthenticated) settingsSave.mutate({ businessName: nextProfile.name, businessType: nextProfile.type, phone: nextProfile.phone, whatsappNumber: nextProfile.whatsapp, email: nextProfile.email, logoUrl: nextProfile.logoUrl ?? "" }); },
  }), [campaignCreate, campaigns, customerCreate, customerRemove, customerUpdate, customers, dashboard, isAuthenticated, leadUpdate, leads, offerCreate, offers, profile, settingsSave]);
  return <LaunchrContext.Provider value={value}>{children}</LaunchrContext.Provider>;
}

export function useLaunchr() { const context = useContext(LaunchrContext); if (!context) throw new Error("useLaunchr must be used inside LaunchrProvider"); return context; }
