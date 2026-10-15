import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  CornerDownLeft,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export function ConversationsPage() {
  const utils = trpc.useUtils();
  const { data: conversations = [], isLoading } = trpc.launchr.conversations.list.useQuery();
  const { data: customers = [] } = trpc.launchr.customers.list.useQuery();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newChatModal, setNewChatModal] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [initialMessage, setInitialMessage] = useState("");

  const activeConversation = conversations.find(c => c.id === selectedId) || conversations[0];

  const sendMessageMutation = trpc.launchr.conversations.sendMessage.useMutation({
    onSuccess: () => {
      utils.launchr.conversations.list.invalidate();
      setReplyText("");
      toast.success("Outreach message sent!");
    },
  });

  const simulateReplyMutation = trpc.launchr.conversations.simulateReply.useMutation({
    onSuccess: () => {
      utils.launchr.conversations.list.invalidate();
      toast.info("New prospect reply received!");
    },
  });

  const createConvoMutation = trpc.launchr.conversations.create.useMutation({
    onSuccess: convo => {
      utils.launchr.conversations.list.invalidate();
      setSelectedId(convo.id);
      setNewChatModal(false);
      setInitialMessage("");
      toast.success("Outreach conversation started!");
    },
  });

  const updateStatusMutation = trpc.launchr.conversations.updateStatus.useMutation({
    onSuccess: () => utils.launchr.conversations.list.invalidate(),
  });

  const convertLeadMutation = trpc.launchr.leads.create.useMutation({
    onSuccess: () => {
      utils.launchr.leads.list.invalidate();
      utils.launchr.dashboard.summary.invalidate();
      if (activeConversation) {
        updateStatusMutation.mutate({ id: activeConversation.id, status: "converted" });
      }
      toast.success("Prospect converted to active Lead!");
    },
  });

  const analyzeReplyMutation = trpc.launchr.ai.analyzeAndSuggestReply.useMutation();

  const openWhatsApp = (msgToSend?: string) => {
    if (!activeConversation) return;
    const text = msgToSend ?? replyText.trim();
    const cleanPhone = (activeConversation.phone || "").replace(/[^0-9+]/g, "").replace(/^00/, "+").replace(/^\+/, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp with drafted message!");
  };

  const openEmail = (msgToSend?: string) => {
    if (!activeConversation) return;
    const text = msgToSend ?? replyText.trim();
    const subject = `Regarding ${activeConversation.company} growth partnership`;
    const url = `mailto:${activeConversation.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.open(url, "_self");
    toast.success("Opening default email client!");
  };

  const handleSendAndOpenApp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!activeConversation || !replyText.trim()) return;

    const textToSend = replyText.trim();

    sendMessageMutation.mutate({
      conversationId: activeConversation.id,
      sender: "business",
      text: textToSend,
      channel: activeConversation.channel,
    });

    if (activeConversation.channel === "whatsapp") {
      openWhatsApp(textToSend);
    } else if (activeConversation.channel === "email") {
      openEmail(textToSend);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !replyText.trim()) return;

    sendMessageMutation.mutate({
      conversationId: activeConversation.id,
      sender: "business",
      text: replyText.trim(),
      channel: activeConversation.channel,
    });
  };

  const handleStartConversation = (e: React.FormEvent) => {
    e.preventDefault();
    const prospect = customers.find(c => String(c.id) === selectedProspectId);
    if (!prospect) {
      toast.error("Please select a prospect");
      return;
    }

    createConvoMutation.mutate({
      prospectId: prospect.id,
      prospectName: prospect.fullName,
      company: prospect.industry || "Business",
      phone: prospect.phone,
      email: prospect.email || undefined,
      channel,
      initialOutreach: initialMessage || undefined,
    });
  };

  const handleAnalyzeAI = () => {
    if (!activeConversation) return;
    const lastProspectMsg = [...activeConversation.messages].reverse().find(m => m.sender === "prospect");
    if (!lastProspectMsg) {
      toast.error("No prospect replies found to analyze yet. You can simulate a reply to test!");
      return;
    }

    analyzeReplyMutation.mutate({
      prospectName: activeConversation.prospectName,
      company: activeConversation.company,
      incomingMessage: lastProspectMsg.text,
      conversationHistory: activeConversation.messages.map(m => ({
        sender: m.sender,
        text: m.text,
      })),
    });
  };

  const handleConvertToLead = () => {
    if (!activeConversation) return;
    convertLeadMutation.mutate({
      fullName: activeConversation.prospectName,
      phone: activeConversation.phone,
      source: `AI Outreach (${activeConversation.channel.toUpperCase()})`,
      status: "Converted",
      notes: `Converted via Launchr AI conversations. Company: ${activeConversation.company}. Last message: ${
        activeConversation.messages.slice(-1)[0]?.text || "No notes"
      }`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1DB954]">
            Two-Way AI Messaging
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Conversations & Follow-ups
          </h2>
          <p className="mt-1 text-xs text-[#8f9a93]">
            Manage prospect replies, automate cadences, and deploy AI objection-handling suggestions to close leads.
          </p>
        </div>
        <button
          onClick={() => setNewChatModal(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 text-xs font-bold text-[#06150c] shadow-[0_4px_16px_rgba(29,185,84,0.25)] transition hover:bg-[#1ed760]"
        >
          <Plus className="h-4 w-4" />
          <span>New Outreach Thread</span>
        </button>
      </div>

      {/* Main Inbox Container */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left List: Conversations */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1210] p-4 lg:col-span-4 flex flex-col h-[680px]">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#707c75]">
              Active Threads ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-[#707c75]">Loading conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#707c75]">
                <MessageSquare className="h-8 w-8 text-white/20 mb-2" />
                <p className="text-xs font-semibold text-[#8f9a93]">No conversations yet</p>
                <p className="text-[11px] mt-1">Start an outreach thread or find prospects with AI.</p>
                <button
                  onClick={() => setNewChatModal(true)}
                  className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08]"
                >
                  Start First Outreach
                </button>
              </div>
            ) : (
              conversations.map(convo => {
                const isSelected = activeConversation?.id === convo.id;
                const lastMsg = convo.messages[convo.messages.length - 1];
                return (
                  <button
                    key={convo.id}
                    onClick={() => setSelectedId(convo.id)}
                    className={`w-full text-left rounded-xl p-3 transition-all border ${
                      isSelected
                        ? "border-[#1DB954]/50 bg-[#1DB954]/10 shadow-sm"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">{convo.prospectName}</p>
                        <p className="truncate text-[11px] text-[#707c75]">{convo.company}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] uppercase font-bold text-[#86edaa]">
                        {convo.channel}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-1 text-[11px] text-[#a2aaa6]">
                      {lastMsg ? (
                        <span>
                          {lastMsg.sender === "business" ? "You: " : "Prospect: "}
                          {lastMsg.text}
                        </span>
                      ) : (
                        "Ready for initial message..."
                      )}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#637068]">
                      <span>{new Date(convo.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      {convo.status === "replied" && (
                        <span className="inline-flex items-center gap-1 text-[#1DB954] font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#1DB954] animate-ping" />
                          Replied
                        </span>
                      )}
                      {convo.status === "converted" && (
                        <span className="text-[#86edaa] font-semibold">Converted</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Active Chat Feed */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1210] flex flex-col h-[680px] lg:col-span-5">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="border-b border-white/10 p-4 flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{activeConversation.prospectName}</h3>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-[#86edaa] font-semibold uppercase">
                      {activeConversation.channel}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#707c75]">{activeConversation.company} • {activeConversation.phone} {activeConversation.email ? `• ${activeConversation.email}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openWhatsApp()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                    title="Open WhatsApp with latest drafted message"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEmail()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/20 transition"
                    title="Open default email client"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email</span>
                  </button>

                  <button
                    onClick={handleConvertToLead}
                    disabled={convertLeadMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#1DB954]/40 bg-[#1DB954]/10 px-2.5 py-1 text-[11px] font-semibold text-[#86edaa] hover:bg-[#1DB954]/20 transition"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Convert to Lead</span>
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeConversation.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-[#707c75]">
                    <Zap className="h-8 w-8 text-[#1DB954]/40 mb-2" />
                    <p className="text-xs text-white font-medium">Outreach Ready</p>
                    <p className="text-[11px] max-w-xs mt-1">
                      Send your first personalized message below or use AI suggestion.
                    </p>
                  </div>
                ) : (
                  activeConversation.messages.map(msg => {
                    const isBusiness = msg.sender === "business";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isBusiness ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                            isBusiness
                              ? "bg-[#1DB954] text-[#06150c] font-medium shadow-md rounded-br-none"
                              : "border border-white/10 bg-white/[0.05] text-white rounded-bl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                        <span className="mt-1 text-[9px] text-[#637068]">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Reply Simulation Bar (For Interactive Testing) */}
              <div className="border-t border-white/5 bg-white/[0.015] px-4 py-2 flex items-center justify-between text-[11px]">
                <span className="text-[#707c75] font-medium">Test Prospect Reply:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => simulateReplyMutation.mutate({ conversationId: activeConversation.id, replyType: "interested" })}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white hover:bg-white/[0.08]"
                  >
                    + "Interested"
                  </button>
                  <button
                    onClick={() => simulateReplyMutation.mutate({ conversationId: activeConversation.id, replyType: "price_check" })}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white hover:bg-white/[0.08]"
                  >
                    + "Price Check"
                  </button>
                  <button
                    onClick={() => simulateReplyMutation.mutate({ conversationId: activeConversation.id, replyType: "objection" })}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white hover:bg-white/[0.08]"
                  >
                    + "Objection"
                  </button>
                </div>
              </div>

              {/* Send Form */}
              <form onSubmit={handleSend} className="border-t border-white/10 p-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Draft message to ${activeConversation.prospectName} via ${activeConversation.channel}...`}
                  className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 h-10 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none"
                />

                {activeConversation.channel === "whatsapp" && (
                  <button
                    type="button"
                    onClick={handleSendAndOpenApp}
                    disabled={!replyText.trim() || sendMessageMutation.isPending}
                    className="flex h-10 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-40"
                    title="Log to conversation and open in WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Send & Open WhatsApp</span>
                  </button>
                )}

                {activeConversation.channel === "email" && (
                  <button
                    type="button"
                    onClick={handleSendAndOpenApp}
                    disabled={!replyText.trim() || sendMessageMutation.isPending}
                    className="flex h-10 items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition disabled:opacity-40"
                    title="Log to conversation and open in Email client"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Send & Open Email</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!replyText.trim() || sendMessageMutation.isPending}
                  className="flex h-10 px-3 items-center justify-center gap-1.5 rounded-xl bg-[#1DB954] text-xs font-bold text-[#06150c] hover:bg-[#1ed760] transition disabled:opacity-40"
                  title="Record message in conversation thread"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#707c75] p-6">
              <p className="text-xs text-white font-medium">Select a conversation</p>
              <p className="text-[11px] mt-1">Choose a prospect thread on the left to start communicating.</p>
            </div>
          )}
        </div>

        {/* Right Side: AI Assistant & Intent Analysis */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1210] p-4 flex flex-col h-[680px] lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#1DB954]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">AI Closer Assistant</h3>
            </div>
            <button
              onClick={handleAnalyzeAI}
              disabled={analyzeReplyMutation.isPending || !activeConversation}
              className="inline-flex items-center gap-1 rounded-lg border border-[#1DB954]/30 bg-[#1DB954]/10 px-2 py-1 text-[10px] font-semibold text-[#86edaa] hover:bg-[#1DB954]/20 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              <span>{analyzeReplyMutation.isPending ? "Analyzing..." : "Analyze Reply"}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {analyzeReplyMutation.data ? (
              <div className="space-y-4">
                {/* Intent & Sentiment Badges */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8f9a93]">Detected Intent:</span>
                    <span className="rounded-full bg-[#1DB954]/20 px-2 py-0.5 text-[10px] font-bold text-[#86edaa] uppercase">
                      {analyzeReplyMutation.data.intent}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-[#8f9a93]">Sentiment:</span>
                    <span className="text-white font-medium capitalize">
                      {analyzeReplyMutation.data.sentiment}
                    </span>
                  </div>
                  {analyzeReplyMutation.data.keyConcern && (
                    <div className="mt-2 border-t border-white/5 pt-2 text-[11px] text-[#b5c2ba]">
                      <span className="text-[#707c75]">Key focus:</span> {analyzeReplyMutation.data.keyConcern}
                    </div>
                  )}
                </div>

                {/* Suggested Replies */}
                <div>
                  <p className="mb-2 text-[11px] font-bold text-white">1-Click Recommended Responses</p>
                  <div className="space-y-2.5">
                    {analyzeReplyMutation.data.suggestedReplies.map((reply, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs space-y-2 hover:border-[#1DB954]/40 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#86edaa] text-[11px]">{reply.label}</span>
                          <button
                            onClick={() => {
                              setReplyText(reply.text);
                              toast.info("Inserted reply into composer!");
                            }}
                            className="text-[10px] font-semibold text-[#1DB954] hover:underline"
                          >
                            Use This
                          </button>
                        </div>
                        <p className="text-[11px] text-[#d2dbd5] italic">"{reply.text}"</p>
                        <p className="text-[10px] text-[#707c75]">{reply.tactic}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#707c75] p-4">
                <Sparkles className="h-7 w-7 text-[#1DB954]/40 mb-2" />
                <p className="text-xs text-white font-semibold">Real-Time Objection Handler</p>
                <p className="text-[11px] mt-1 leading-relaxed">
                  When a prospect replies, click "Analyze Reply" to get instant intent detection and optimized booking responses.
                </p>
              </div>
            )}
          </div>

          {/* Cadence Status */}
          {activeConversation && (
            <div className="mt-auto border-t border-white/10 pt-3 text-[11px] text-[#707c75]">
              <div className="flex items-center justify-between">
                <span>Follow-up Cadence:</span>
                <span className={activeConversation.followUpPaused ? "text-[#f4b251]" : "text-[#86edaa]"}>
                  {activeConversation.followUpPaused ? "Paused (Prospect Active)" : `Step ${activeConversation.followUpStep} Active`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Outreach Thread Modal */}
      {newChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setNewChatModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1210] p-6 text-white shadow-2xl">
            <h3 className="text-lg font-bold">Start Outreach Thread</h3>
            <p className="mt-1 text-xs text-[#8f9a93]">
              Select a prospect from your database to initiate two-way communication.
            </p>

            <form onSubmit={handleStartConversation} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-[#b5c2ba] mb-1">Target Prospect</label>
                <select
                  value={selectedProspectId}
                  onChange={e => setSelectedProspectId(e.target.value)}
                  required
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#141b18] px-3 text-xs text-white focus:border-[#1DB954] focus:outline-none"
                >
                  <option value="">Select a prospect...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.industry || "General"}) - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#b5c2ba] mb-1">Outreach Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["whatsapp", "sms", "email"] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`rounded-xl py-2 text-xs font-semibold capitalize transition ${
                        channel === ch
                          ? "bg-[#1DB954] text-[#06150c]"
                          : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#b5c2ba] mb-1">Initial Outreach Message</label>
                <textarea
                  value={initialMessage}
                  onChange={e => setInitialMessage(e.target.value)}
                  placeholder="Type or paste your personalized outreach message..."
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-[#141b18] p-3 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewChatModal(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-semibold text-white hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createConvoMutation.isPending}
                  className="flex-1 rounded-xl bg-[#1DB954] py-2 text-xs font-bold text-[#06150c] hover:bg-[#1ed760]"
                >
                  Start Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
