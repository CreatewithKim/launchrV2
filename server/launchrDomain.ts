export type DashboardCampaign = { status: string };
export type DashboardMetric = { sentCount: number; leadCount: number } | null;
export type DashboardLead = { status: string };

export function summarizeDashboard(input: {
  customerCount: number;
  campaigns: DashboardCampaign[];
  metrics: DashboardMetric[];
  leads: DashboardLead[];
}) {
  const totals = input.metrics.reduce((result, metric) => ({
    sent: result.sent + (metric?.sentCount ?? 0),
    leads: result.leads + (metric?.leadCount ?? 0),
  }), { sent: 0, leads: 0 });
  const converted = input.leads.filter(lead => lead.status === "Converted").length;
  return {
    totalCustomers: input.customerCount,
    activeCampaigns: input.campaigns.filter(campaign => campaign.status === "Active").length,
    messagesSent: totals.sent,
    leadsGenerated: totals.leads,
    conversionRate: input.leads.length ? Number(((converted / input.leads.length) * 100).toFixed(1)) : 0,
  };
}

export function scheduleIsValid(mode: "now" | "schedule", scheduledAt?: Date) {
  return mode === "now" || Boolean(scheduledAt && !Number.isNaN(scheduledAt.getTime()));
}
