import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clearWorkspaceData,
  createCampaign,
  createCustomer,
  createLead,
  createOffer,
  deleteCampaign,
  deleteCustomer,
  deleteLead,
  deleteOffer,
  getBusinessSettings,
  getCustomerImport,
  getDashboardSummary,
  getPersonalProfile,
  importCustomerCsvData,
  listCampaignPerformance,
  listCampaigns,
  listCustomerImports,
  listCustomers,
  listLeads,
  listOffers,
  saveBusinessSettings,
  savePersonalProfile,
  updateCampaignStatus,
  updateCustomer,
  updateLead,
  updateOfferStatus,
} from "../db";
import { campaignStatuses, customerSegments, leadStatuses, offerStatuses } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { scheduleIsValid } from "../launchrDomain";
import { parseCustomerCsv } from "../customerImport";
import {
  analyzeAndSuggestReply,
  findProspectsWithAI,
  generateCharacterVoiceNarration,
  generateFollowUpSequence,
  personalizeOutreachMessage,
} from "../launchrAI";
import {
  addMessageToConversation,
  createOrGetConversation,
  getConversation,
  listConversations,
  updateConversationStatus,
} from "../conversations";

const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

const customerInput = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().min(4).max(40),
  industry: z.string().trim().min(1).max(120),
  segment: z.enum(customerSegments),
  orderCount: z.number().int().min(0).default(0),
  lifetimeSpendCents: z.number().int().min(0).default(0),
  lastActiveAt: z.date().optional(),
});

const offerInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1),
  type: z.string().trim().min(1).max(80),
  imageUrl: z.string().max(1000).optional().or(z.literal("")),
  cta: z.string().trim().min(1).max(120),
  startsAt: z.date(),
  endsAt: z.date(),
  status: z.enum(offerStatuses),
}).refine(value => value.endsAt > value.startsAt, { message: "End date must come after start date", path: ["endsAt"] });

const leadInput = z.object({
  fullName: z.string().min(1).max(160),
  phone: z.string().min(4).max(40),
  source: z.string().min(1).max(180),
  campaignId: z.number().int().positive().optional(),
  status: z.enum(leadStatuses).default("New"),
  notes: z.string().max(5000).optional(),
});

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+/, "") || "upload";
}

async function storeImage(ownerId: number, kind: "offer-images" | "business-logos", input: { fileName: string; contentType: (typeof imageTypes)[number]; base64: string }) {
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.byteLength > 5_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Image files must be 5 MB or smaller." });
  return storagePut(`${ownerId}/${kind}/${Date.now()}-${safeFileName(input.fileName)}`, bytes, input.contentType);
}

export const launchrRouter = router({
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => getDashboardSummary(ctx.user.id)),
  }),
  customers: router({
    list: protectedProcedure.input(z.object({ segment: z.enum(customerSegments).optional() }).optional()).query(({ ctx, input }) => listCustomers(ctx.user.id, input?.segment)),
    create: protectedProcedure.input(customerInput).mutation(async ({ ctx, input }) => {
      return createCustomer(ctx.user.id, input);
    }),
    batchCreate: protectedProcedure.input(z.array(customerInput)).mutation(async ({ ctx, input }) => {
      const results = [];
      for (const item of input) {
        const res = await createCustomer(ctx.user.id, item);
        results.push(res);
      }
      return { count: results.length, ids: results.map(r => r.id) };
    }),
    update: protectedProcedure.input(customerInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      try {
        return await updateCustomer(ctx.user.id, id, changes);
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message || "Customer not found." });
      }
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      return deleteCustomer(ctx.user.id, input.id);
    }),
    importCsv: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(180), content: z.string().min(1).max(1_500_000), defaultIndustry: z.string().trim().min(1).max(120) })).mutation(async ({ ctx, input }) => {
      const parsedRows = parseCustomerCsv(input.content, input.defaultIndustry);
      if (!parsedRows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No CSV data rows were found." });
      if (parsedRows.length > 5_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Import up to 5,000 rows at a time." });

      const bytes = Buffer.from(input.content, "utf8");
      const file = await storagePut(`${ctx.user.id}/customer-imports/${Date.now()}-${safeFileName(input.fileName)}`, bytes, "text/csv");
      return importCustomerCsvData(ctx.user.id, {
        fileName: input.fileName,
        sourceUrl: file.url,
        parsedRows,
      });
    }),
    imports: router({
      list: protectedProcedure.query(({ ctx }) => listCustomerImports(ctx.user.id)),
      get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const record = await getCustomerImport(ctx.user.id, input.id);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Import not found." });
        return record;
      }),
    }),
  }),
  offers: router({
    list: protectedProcedure.query(({ ctx }) => listOffers(ctx.user.id)),
    uploadImage: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(180), contentType: z.enum(imageTypes), base64: z.string().min(1).max(7_000_000) })).mutation(({ ctx, input }) => storeImage(ctx.user.id, "offer-images", input)),
    create: protectedProcedure.input(offerInput).mutation(async ({ ctx, input }) => {
      return createOffer(ctx.user.id, input);
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(offerStatuses) })).mutation(async ({ ctx, input }) => {
      try {
        return await updateOfferStatus(ctx.user.id, input.id, input.status);
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message || "Offer not found." });
      }
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await deleteOffer(ctx.user.id, input.id);
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message || "Offer not found." });
      }
    }),
  }),
  campaigns: router({
    list: protectedProcedure.query(({ ctx }) => listCampaigns(ctx.user.id)),
    create: protectedProcedure.input(z.object({ offerId: z.number().int().positive(), name: z.string().min(1).max(180), audienceSegment: z.enum(customerSegments), mode: z.enum(["now", "schedule"]), scheduledAt: z.date().optional() })).mutation(async ({ ctx, input }) => {
      if (!scheduleIsValid(input.mode, input.scheduledAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "A schedule date is required." });
      try {
        return await createCampaign(ctx.user.id, input);
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message || "Offer not found." });
      }
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(campaignStatuses) })).mutation(async ({ ctx, input }) => {
      try {
        return await updateCampaignStatus(ctx.user.id, input.id, input.status);
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message || "Campaign not found." });
      }
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      return deleteCampaign(ctx.user.id, input.id);
    }),
  }),
  leads: router({
    list: protectedProcedure.input(z.object({ status: z.enum(leadStatuses).optional() }).optional()).query(({ ctx, input }) => listLeads(ctx.user.id, input?.status)),
    create: protectedProcedure.input(leadInput).mutation(async ({ ctx, input }) => {
      return createLead(ctx.user.id, input);
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(leadStatuses).optional(), notes: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      try {
        return await updateLead(ctx.user.id, id, changes);
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message || "Lead not found." });
      }
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      return deleteLead(ctx.user.id, input.id);
    }),
  }),
  // AI-Powered Growth Suite
  ai: router({
    findProspects: protectedProcedure
      .input(
        z.object({
          targetNiche: z.string().min(1),
          location: z.string().min(1),
          targetRole: z.string().optional(),
          count: z.number().int().min(1).max(8).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const business = await getBusinessSettings(ctx.user.id);
        return findProspectsWithAI({
          ...input,
          businessName: business?.businessName || undefined,
          businessType: business?.businessType || undefined,
        });
      }),
    personalizeOutreach: protectedProcedure
      .input(
        z.object({
          prospectName: z.string().min(1),
          company: z.string().min(1),
          industry: z.string().min(1),
          painPoint: z.string().optional(),
          offerTitle: z.string().min(1),
          offerDetails: z.string().min(1),
          channel: z.enum(["whatsapp", "sms", "email"]),
          tone: z.enum(["direct", "consultative", "friendly", "high_converting"]),
        })
      )
      .mutation(async ({ input }) => {
        return personalizeOutreachMessage(input);
      }),
    followUpSequence: protectedProcedure
      .input(
        z.object({
          prospectName: z.string().min(1),
          company: z.string().min(1),
          offerTitle: z.string().min(1),
          channel: z.enum(["whatsapp", "sms", "email"]),
        })
      )
      .mutation(async ({ input }) => {
        return generateFollowUpSequence(input);
      }),
    analyzeAndSuggestReply: protectedProcedure
      .input(
        z.object({
          prospectName: z.string().min(1),
          company: z.string().min(1),
          incomingMessage: z.string().min(1),
          conversationHistory: z.array(
            z.object({
              sender: z.enum(["business", "prospect"]),
              text: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return analyzeAndSuggestReply(input);
      }),
    speak: protectedProcedure
      .input(
        z.object({
          text: z.string().min(1),
          voiceName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return generateCharacterVoiceNarration(input);
      }),
  }),
  // Conversation & Follow-up Inbox
  conversations: router({
    list: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
      const convo = getConversation(ctx.user.id, input.id);
      if (!convo) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      return convo;
    }),
    create: protectedProcedure
      .input(
        z.object({
          prospectId: z.number().int().positive().optional(),
          prospectName: z.string().min(1),
          company: z.string().min(1),
          phone: z.string().min(4),
          email: z.string().email().optional().or(z.literal("")),
          channel: z.enum(["whatsapp", "sms", "email"]),
          initialOutreach: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        return createOrGetConversation(ctx.user.id, {
          ...input,
          email: input.email || undefined,
        });
      }),
    sendMessage: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          sender: z.enum(["business", "prospect"]),
          text: z.string().min(1),
          channel: z.enum(["whatsapp", "sms", "email"]).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        return addMessageToConversation(ctx.user.id, input);
      }),
    simulateReply: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          replyType: z.enum(["interested", "price_check", "objection", "timing"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const convo = getConversation(ctx.user.id, input.conversationId);
        if (!convo) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

        const replies: Record<string, { text: string; intent: any }> = {
          interested: {
            text: `Hi! This actually sounds relevant for us. We're looking to scale this quarter. Can we do a quick 10-minute call tomorrow?`,
            intent: "interested",
          },
          price_check: {
            text: `Thanks for the note. What does pricing look like for this? Do you work on performance or retainers?`,
            intent: "pricing_question",
          },
          objection: {
            text: `We already tested an agency last year and didn't get results. How is this different?`,
            intent: "objection",
          },
          timing: {
            text: `A bit slammed right now with our peak season. Could you follow up with me in 3 weeks?`,
            intent: "timing_issue",
          },
        };

        const reply = replies[input.replyType] || replies.interested;
        return addMessageToConversation(ctx.user.id, {
          conversationId: input.conversationId,
          sender: "prospect",
          text: reply.text,
          intent: reply.intent,
        });
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["active", "replied", "meeting_booked", "converted", "closed"]),
        })
      )
      .mutation(({ ctx, input }) => {
        return updateConversationStatus(ctx.user.id, input.id, input.status);
      }),
  }),
  analytics: router({
    campaignPerformance: protectedProcedure.query(({ ctx }) => listCampaignPerformance(ctx.user.id)),
  }),
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const saved = await getPersonalProfile(ctx.user.id);
      return saved ?? { fullName: ctx.user.name ?? "", email: ctx.user.email ?? "", phone: "", jobTitle: "" };
    }),
    save: protectedProcedure.input(z.object({ fullName: z.string().trim().min(1).max(160), email: z.string().email().optional().or(z.literal("")), phone: z.string().max(40).optional(), jobTitle: z.string().max(120).optional() })).mutation(async ({ ctx, input }) => {
      return savePersonalProfile(ctx.user.id, input);
    }),
  }),
  clearWorkspace: protectedProcedure.mutation(async ({ ctx }) => {
    return clearWorkspaceData(ctx.user.id);
  }),
  settings: router({
    get: protectedProcedure.query(({ ctx }) => getBusinessSettings(ctx.user.id)),
    uploadLogo: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(180), contentType: z.enum(imageTypes), base64: z.string().min(1).max(7_000_000) })).mutation(({ ctx, input }) => storeImage(ctx.user.id, "business-logos", input)),
    save: protectedProcedure.input(z.object({ businessName: z.string().min(1).max(160), businessType: z.string().min(1).max(120), phone: z.string().max(40).optional(), whatsappNumber: z.string().max(40).optional(), email: z.string().email().optional().or(z.literal("")), logoUrl: z.string().max(1000).optional().or(z.literal("")) })).mutation(async ({ ctx, input }) => {
      return saveBusinessSettings(ctx.user.id, input);
    }),
  }),
});
