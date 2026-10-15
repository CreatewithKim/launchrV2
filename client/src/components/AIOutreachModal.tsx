import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Bot,
  Calendar,
  Check,
  Clock,
  Copy,
  Flame,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface AIOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProspectId?: number;
  defaultProspectId?: number;
}

export function AIOutreachModal({ isOpen, onClose, preselectedProspectId, defaultProspectId }: AIOutreachModalProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: customers = [] } = trpc.launchr.customers.list.useQuery();
  const { data: offers = [] } = trpc.launchr.offers.list.useQuery();

  const initialId = preselectedProspectId ?? defaultProspectId;
  const [selectedProspectId, setSelectedProspectId] = useState<string>(
    initialId ? String(initialId) : ""
  );

  useEffect(() => {
    if (initialId) {
      setSelectedProspectId(String(initialId));
    }
  }, [initialId, isOpen]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [tone, setTone] = useState<"direct" | "consultative" | "friendly" | "high_converting">("high_converting");
  const [activeTab, setActiveTab] = useState<"message" | "cadence">("message");

  const personalizeMutation = trpc.launchr.ai.personalizeOutreach.useMutation();
  const cadenceMutation = trpc.launchr.ai.followUpSequence.useMutation();
  const createConvoMutation = trpc.launchr.conversations.create.useMutation({
    onSuccess: convo => {
      utils.launchr.conversations.list.invalidate();
      toast.success("Outreach message dispatched to Conversations inbox!");
      onClose();
      setLocation("/conversations");
    },
  });

  if (!isOpen) return null;

  const currentProspect = customers.find(c => String(c.id) === selectedProspectId);
  const currentOffer = offers.find(o => String(o.id) === selectedOfferId) || offers[0];

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProspect) {
      toast.error("Please choose a prospect");
      return;
    }

    const offerTitle = currentOffer?.title || "Exclusive Growth Acceleration Offer";
    const offerDetails = currentOffer?.description || "Guaranteed increase in booked clients";

    personalizeMutation.mutate({
      prospectName: currentProspect.fullName,
      company: currentProspect.industry || "Business",
      industry: currentProspect.industry || "B2B",
      offerTitle,
      offerDetails,
      channel,
      tone,
    });

    cadenceMutation.mutate({
      prospectName: currentProspect.fullName,
      company: currentProspect.industry || "Business",
      offerTitle,
      channel,
    });
  };

  const handleDirectSend = () => {
    if (!currentProspect || !personalizeMutation.data) return;

    const message = personalizeMutation.data.message;
    const cleanPhone = (currentProspect.phone || "").replace(/[^0-9+]/g, "").replace(/^00/, "+");

    if (channel === "whatsapp") {
      const waPhone = cleanPhone.replace(/^\+/, "");
      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp with pre-filled outreach message!");
    } else if (channel === "email") {
      const subject = personalizeMutation.data.subject || `Exclusive offer for ${currentProspect.industry || "your business"}`;
      const mailUrl = `mailto:${currentProspect.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.open(mailUrl, "_self");
      toast.success("Opening email client with pre-filled outreach message!");
    } else if (channel === "sms") {
      const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
      window.open(smsUrl, "_self");
      toast.success("Opening SMS with pre-filled outreach message!");
    }

    // Also persist into Launchr conversations inbox
    createConvoMutation.mutate({
      prospectId: currentProspect.id,
      prospectName: currentProspect.fullName,
      company: currentProspect.industry || "Target Co",
      phone: currentProspect.phone,
      email: currentProspect.email || undefined,
      channel,
      initialOutreach: message,
    });
  };

  const handleLaunchOutreach = () => {
    if (!currentProspect || !personalizeMutation.data) return;

    createConvoMutation.mutate({
      prospectId: currentProspect.id,
      prospectName: currentProspect.fullName,
      company: currentProspect.industry || "Target Co",
      phone: currentProspect.phone,
      email: currentProspect.email || undefined,
      channel,
      initialOutreach: personalizeMutation.data.message,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1210] p-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1DB954] text-[#06150c] shadow-[0_0_20px_rgba(29,185,84,0.3)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold">AI Outreach & Follow-Up Generator</h3>
              <p className="text-xs text-[#8f9a93]">
                Personalize high-converting copy and automate multi-touch cadences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#707c75] hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <form onSubmit={handleGenerate} className="mt-5 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Target Prospect</label>
              <select
                value={selectedProspectId}
                onChange={e => setSelectedProspectId(e.target.value)}
                required
                className="h-10 w-full rounded-xl border border-white/10 bg-[#141b18] px-3 text-xs text-white focus:border-[#1DB954] focus:outline-none"
              >
                <option value="">Select a prospect...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.industry || "General"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Attach Core Offer</label>
              <select
                value={selectedOfferId}
                onChange={e => setSelectedOfferId(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#141b18] px-3 text-xs text-white focus:border-[#1DB954] focus:outline-none"
              >
                <option value="">Select an offer (or default promotion)...</option>
                {offers.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Outreach Channel</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["whatsapp", "sms", "email"] as const).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`rounded-xl py-2 text-xs font-semibold uppercase transition ${
                      channel === ch
                        ? "bg-[#1DB954] text-[#06150c]"
                        : "border border-white/10 bg-white/[0.03] text-[#8f9a93] hover:text-white"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Persuasion Tone</label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as any)}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#141b18] px-3 text-xs text-white focus:border-[#1DB954] focus:outline-none"
              >
                <option value="high_converting">High-Converting (Low friction hook)</option>
                <option value="direct">Direct & Punchy</option>
                <option value="consultative">Consultative & Value-first</option>
                <option value="friendly">Warm & Relationship-driven</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={personalizeMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1DB954] px-5 text-xs font-bold text-[#06150c] shadow-[0_4px_14px_rgba(29,185,84,0.25)] hover:bg-[#1ed760] transition disabled:opacity-50"
            >
              {personalizeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Personalizing with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Outreach & Follow-up Cadence</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Results Showcase */}
        {personalizeMutation.data && (
          <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
            {/* View Switcher */}
            <div className="flex rounded-xl border border-white/10 bg-white/[0.02] p-1 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("message")}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === "message"
                    ? "bg-[#1DB954] text-[#06150c]"
                    : "text-[#8f9a93] hover:text-white"
                }`}
              >
                Initial Message
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cadence")}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === "cadence"
                    ? "bg-[#1DB954] text-[#06150c]"
                    : "text-[#8f9a93] hover:text-white"
                }`}
              >
                3-Step Follow-up Cadence ({cadenceMutation.data?.length || 3})
              </button>
            </div>

            {activeTab === "message" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  {personalizeMutation.data.subject && (
                    <div className="mb-2 border-b border-white/5 pb-2 text-xs">
                      <span className="text-[#707c75]">Subject: </span>
                      <span className="font-semibold text-white">{personalizeMutation.data.subject}</span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap text-xs text-[#e1e8e4] leading-relaxed">
                    {personalizeMutation.data.message}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(personalizeMutation.data.message)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#8f9a93] hover:text-white transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Text</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLaunchOutreach}
                        disabled={createConvoMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white hover:bg-white/[0.08] transition"
                        title="Save outreach and start conversation thread without opening external app"
                      >
                        <span>Log to Inbox</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDirectSend}
                        disabled={createConvoMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2 text-xs font-bold text-[#06150c] hover:bg-[#1ed760] transition shadow-[0_0_20px_rgba(29,185,84,0.35)]"
                      >
                        {channel === "whatsapp" ? (
                          <>
                            <MessageCircle className="h-4 w-4" />
                            <span>Send via WhatsApp</span>
                          </>
                        ) : channel === "email" ? (
                          <>
                            <Mail className="h-4 w-4" />
                            <span>Send via Email</span>
                          </>
                        ) : (
                          <>
                            <Phone className="h-4 w-4" />
                            <span>Send via SMS</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.015] p-3 text-[11px] text-[#8f9a93]">
                  <span className="text-[#1DB954] font-semibold">Why this converts: </span>
                  {personalizeMutation.data.whyItWorks}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cadenceMutation.data?.map(step => (
                  <div key={step.stepNumber} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#86edaa] text-xs">{step.name}</span>
                      <span className="text-[10px] text-[#707c75] font-mono">
                        {step.dayOffset === 0 ? "Send Immediately" : `Wait ${step.dayOffset} days`}
                      </span>
                    </div>
                    <p className="text-xs text-[#d2dbd5] whitespace-pre-wrap bg-white/[0.02] p-3 rounded-lg border border-white/5">
                      {step.message}
                    </p>
                    <p className="text-[10px] text-[#707c75]">
                      <span className="text-[#9ba59f] font-medium">Strategy: </span>
                      {step.strategy}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
