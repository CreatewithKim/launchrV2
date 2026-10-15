import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Compass,
  DollarSign,
  ExternalLink,
  Flame,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Sparkles,
  Target,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface AIProspectFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AIProspectFinderModal({ isOpen, onClose, onSuccess }: AIProspectFinderModalProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [niche, setNiche] = useState("Dental Clinics");
  const [location, setLocalLocation] = useState("Austin, TX");
  const [role, setRole] = useState("Practice Owner / Managing Director");
  const [count, setCount] = useState(4);
  const [importedIndices, setImportedIndices] = useState<number[]>([]);

  const findProspectsMutation = trpc.launchr.ai.findProspects.useMutation({
    onSuccess: () => {
      setImportedIndices([]);
    },
    onError: err => {
      toast.error(err.message || "Failed to find prospects");
    },
  });

  const batchCreateMutation = trpc.launchr.customers.batchCreate.useMutation({
    onSuccess: data => {
      utils.launchr.customers.list.invalidate();
      utils.launchr.dashboard.summary.invalidate();
      toast.success(`Imported ${data.count} targeted prospects into your pipeline!`);
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: err => {
      toast.error(err.message || "Could not save prospects");
    },
  });

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    findProspectsMutation.mutate({
      targetNiche: niche,
      location,
      targetRole: role,
      count,
    });
  };

  const handleImportSingle = (prospect: (typeof findProspectsMutation.data extends (infer U)[] | undefined ? U : any), index: number) => {
    batchCreateMutation.mutate([
      {
        fullName: prospect.fullName,
        email: prospect.email,
        phone: prospect.phone,
        industry: `${prospect.company} (${prospect.industry})`,
        segment: "New" as const,
        orderCount: 0,
        lifetimeSpendCents: prospect.dealValueCents || 100000,
      }
    ], {
      onSuccess: () => {
        setImportedIndices(prev => [...prev, index]);
        toast.success(`Added ${prospect.company} to pipeline`);
      }
    });
  };

  const handleImportAll = () => {
    if (!findProspectsMutation.data || findProspectsMutation.data.length === 0) return;

    batchCreateMutation.mutate(
      findProspectsMutation.data.map(p => ({
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        industry: `${p.company} (${p.industry})`,
        segment: "New" as const,
        orderCount: 0,
        lifetimeSpendCents: p.dealValueCents || 100000,
      }))
    );
  };

  const openWhatsApp = (phone: string, name: string, hook: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const text = encodeURIComponent(`Hi ${name}, ${hook}`);
    const url = `https://wa.me/${cleanPhone}?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1210] p-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1DB954] text-[#06150c] shadow-[0_0_20px_rgba(29,185,84,0.3)]">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">AI Web Scraper & Prospect Finder</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1DB954]/15 px-2 py-0.5 text-[10px] font-bold text-[#86edaa]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                  Live Web Scraper
                </span>
              </div>
              <p className="text-xs text-[#8f9a93]">
                Scrapes live commercial registries, verified business websites, physical locations, and decision makers
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

        {/* Input Controls */}
        <form onSubmit={handleSearch} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Target Niche / Industry</label>
            <input
              type="text"
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="e.g. Dental Clinics, Roofing, Fitness Gyms"
              required
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Geography / Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocalLocation(e.target.value)}
              placeholder="e.g. Austin, TX, Miami, FL, London, UK"
              required
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Target Role</label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Owner, Founder, CEO"
              required
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3 flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[#78847c]">
              <Globe className="h-3.5 w-3.5 text-[#1DB954]" />
              <span>Scrapes registered businesses, live websites & emails</span>
            </div>
            <button
              type="submit"
              disabled={findProspectsMutation.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-5 text-xs font-bold text-[#06150c] shadow-[0_4px_14px_rgba(29,185,84,0.25)] transition hover:bg-[#1ed760] disabled:opacity-50"
            >
              {findProspectsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Scraping Live Web & Registry...</span>
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4" />
                  <span>Scrape & Find Real Prospects</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Results List */}
        {findProspectsMutation.data && findProspectsMutation.data.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8f9a93]">
                  Verified Real Businesses ({findProspectsMutation.data.length})
                </span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#86edaa]">
                  100% Live Scraped
                </span>
              </div>
              <button
                onClick={handleImportAll}
                disabled={batchCreateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1DB954] px-3 py-1.5 text-xs font-bold text-[#06150c] hover:bg-[#1ed760] transition disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Import All to Pipeline</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {findProspectsMutation.data.map((prospect, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-xs space-y-2.5 hover:border-[#1DB954]/40 transition group"
                >
                  {/* Top Bar: Company Name & Match Score */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#1DB954] shrink-0" />
                        <h4 className="font-bold text-white text-sm leading-tight">{prospect.company}</h4>
                      </div>
                      <p className="text-[11px] text-[#1DB954] font-semibold mt-0.5">
                        {prospect.fullName} · <span className="text-[#a4b1aa] font-normal">{prospect.role}</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-[#1DB954]/15 px-2 py-0.5 text-[10px] font-bold text-[#86edaa] shrink-0">
                      {prospect.matchScore}% Match
                    </span>
                  </div>

                  {/* Address & Website (Scraped live) */}
                  <div className="space-y-1 rounded-lg bg-black/30 p-2 text-[11px] border border-white/5">
                    {prospect.address && (
                      <div className="flex items-start gap-1.5 text-[#b0bbb4]">
                        <MapPin className="h-3.5 w-3.5 text-[#86edaa] shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{prospect.address}</span>
                      </div>
                    )}
                    {prospect.website && (
                      <div className="flex items-center gap-1.5 text-[#86edaa]">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <a
                          href={prospect.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{prospect.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Scraped Contacts */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[#939f97]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3 w-3 text-[#1DB954] shrink-0" />
                      <a href={`tel:${prospect.phone}`} className="truncate hover:text-white">
                        {prospect.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 text-[#1DB954] shrink-0" />
                      <a href={`mailto:${prospect.email}`} className="truncate hover:text-white" title={prospect.email}>
                        {prospect.email}
                      </a>
                    </div>
                  </div>

                  {/* Icebreaker Hook & Pain Point */}
                  <div className="border-t border-white/5 pt-2 text-[11px] space-y-1 text-[#a2aaa6]">
                    <p className="line-clamp-2">
                      <span className="text-[#707c75] font-semibold">Pain Point:</span> {prospect.painPoint}
                    </p>
                    <p className="line-clamp-2 italic text-[#cbd5cf]">
                      <span className="text-[#707c75] font-semibold not-italic">Scraped Hook:</span> "{prospect.icebreakerHook}"
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                    <button
                      type="button"
                      onClick={() => openWhatsApp(prospect.phone, prospect.fullName, prospect.icebreakerHook)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/15 px-2.5 py-1 text-[10px] font-bold text-[#25D366] hover:bg-[#25D366]/25 transition"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span>WhatsApp</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`mailto:${prospect.email}?subject=${encodeURIComponent(`Quick question regarding ${prospect.company}`)}&body=${encodeURIComponent(`Hi ${prospect.fullName},\n\n${prospect.icebreakerHook}\n\nBest regards,`)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-[#cbd5cf] hover:bg-white/[0.1] hover:text-white transition"
                      >
                        <Mail className="h-3 w-3" />
                        <span>Email</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleImportSingle(prospect, idx)}
                        disabled={importedIndices.includes(idx) || batchCreateMutation.isPending}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                          importedIndices.includes(idx)
                            ? "bg-[#1DB954]/20 text-[#86edaa]"
                            : "bg-[#1DB954] text-[#06150c] hover:bg-[#1ed760]"
                        }`}
                      >
                        {importedIndices.includes(idx) ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
