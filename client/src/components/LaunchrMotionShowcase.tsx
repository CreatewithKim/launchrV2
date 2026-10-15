import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Sparkles,
  Send,
  MessageCircle,
  Mail,
  Phone,
  Target,
  Gift,
  ChevronRight,
  Compass,
  ArrowRight,
  Layers,
  Clock,
  Box,
  Zap,
  CheckCircle2,
  ArrowDown,
  TrendingUp,
} from "lucide-react";

interface MotionScene {
  id: string;
  badge: string;
  kineticTitle: string;
  subtitle: string;
  timestamp: string;
  startSec: number;
  duration: number;
  actionLabel: string;
  actionType: "offer" | "finder" | "outreach" | "inbox";
}

const scenes: MotionScene[] = [
  {
    id: "scene_cards",
    badge: "01 // OFFER STUDIO",
    kineticTitle: "All You Need to Scale",
    subtitle: "Stacked 3D offer cards fan out automatically. Define your offer title, discount terms, and target segment in seconds.",
    timestamp: "0:00",
    startSec: 0,
    duration: 35,
    actionLabel: "Create First Offer",
    actionType: "offer",
  },
  {
    id: "scene_box",
    badge: "02 // EVERYTHING INTEGRATED",
    kineticTitle: "We Have Everything Integrated",
    subtitle: "One unified acquisition engine linking Live Web Scraping, WhatsApp Web, Email, SMS, and Two-Way AI Closing.",
    timestamp: "0:35",
    startSec: 35,
    duration: 35,
    actionLabel: "Try AI Web Scraper",
    actionType: "finder",
  },
  {
    id: "scene_delivery",
    badge: "03 // SAME-DAY ACQUISITION",
    kineticTitle: "Same-Day Customer Acquisition",
    subtitle: "Radar scanner discovers verified local decision makers live, generating personalized 1-click WhatsApp and Email outreach.",
    timestamp: "1:10",
    startSec: 70,
    duration: 35,
    actionLabel: "Launch WhatsApp Outreach",
    actionType: "outreach",
  },
  {
    id: "scene_pipeline",
    badge: "04 // MY PIPELINE",
    kineticTitle: "My Orders & Lead Pipeline",
    subtitle: "Domino card cascade tracks every lead stage automatically from initial inquiry to AI objection handling and booked meeting.",
    timestamp: "1:45",
    startSec: 105,
    duration: 30,
    actionLabel: "Open AI Conversations",
    actionType: "inbox",
  },
];

const totalDuration = 135; // 2:15 total

export function LaunchrMotionShowcase({
  onOpenFinder,
  onOpenOutreach,
}: {
  onOpenFinder?: () => void;
  onOpenOutreach?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion graphics timer loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= totalDuration) {
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Sync active scene
  useEffect(() => {
    const sceneIdx = scenes.findIndex(
      (s, idx) =>
        currentTime >= s.startSec &&
        (idx === scenes.length - 1 || currentTime < scenes[idx + 1].startSec)
    );
    if (sceneIdx !== -1 && sceneIdx !== activeSceneIndex) {
      setActiveSceneIndex(sceneIdx);
    }
  }, [currentTime]);

  const currentScene = scenes[activeSceneIndex] || scenes[0];

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
  };

  const jumpToScene = (index: number) => {
    setActiveSceneIndex(index);
    setCurrentTime(scenes[index].startSec);
    setIsPlaying(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleActionClick = (type: MotionScene["actionType"]) => {
    if (type === "finder" && onOpenFinder) {
      onOpenFinder();
    } else if (type === "outreach" && onOpenOutreach) {
      onOpenOutreach();
    } else if (type === "offer") {
      window.location.href = "/offers";
    } else if (type === "inbox") {
      window.location.href = "/conversations";
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-3xl border border-white/10 bg-[#090e0b] shadow-2xl transition-all"
    >
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] bg-black/40 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1DB954] text-[#06130a] shadow-[0_0_20px_rgba(29,185,84,0.4)]">
            <Box className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">How Launchr Works — 3D Motion Showcase</h3>
              <span className="rounded-full bg-[#1DB954]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#86edaa] uppercase tracking-wider">
                Interactive 3D
              </span>
            </div>
            <p className="text-[11px] text-[#818d86]">
              A dynamic, kinetic 3D walkthrough explaining the full acquisition pipeline
            </p>
          </div>
        </div>

        {/* Scene Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {scenes.map((s, idx) => {
            const isActive = activeSceneIndex === idx;
            return (
              <button
                key={s.id}
                onClick={() => jumpToScene(idx)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
                  isActive
                    ? "bg-[#1DB954] text-[#06130a] shadow-[0_0_15px_rgba(29,185,84,0.3)]"
                    : "border border-white/10 bg-white/[0.03] text-[#8e9992] hover:text-white"
                }`}
              >
                0{idx + 1}. {s.kineticTitle.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Motion Graphic Stage Canvas */}
      <div className="relative min-h-[460px] sm:min-h-[500px] bg-[radial-gradient(ellipse_at_top_center,rgba(29,185,84,0.15),transparent_65%),#060907] p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
        {/* Soft Background Mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Kinetic Title Bar */}
        <div className="relative z-20 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-mono font-bold uppercase text-[#86edaa] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1DB954] animate-ping" />
              {currentScene.badge}
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight text-white">
              {currentScene.kineticTitle}
            </h2>
            <p className="mt-1.5 max-w-xl text-xs sm:text-sm text-[#9da8a2] leading-relaxed">
              {currentScene.subtitle}
            </p>
          </div>

          <button
            onClick={() => handleActionClick(currentScene.actionType)}
            className="shrink-0 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#1DB954] px-6 text-xs font-extrabold text-[#06130a] shadow-[0_0_30px_rgba(29,185,84,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            <span>{currentScene.actionLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Center 3D Graphics Viewport */}
        <div className="relative z-10 my-8 flex-1 flex items-center justify-center [perspective:1200px]">
          {/* SCENE 1: Cascading 3D Offer Cards Deck (Inspo: Stacked Amazon cards) */}
          {currentScene.id === "scene_cards" && (
            <div className="relative w-full max-w-lg flex items-center justify-center h-64 [transform-style:preserve-3d]">
              {/* Bold Animated Yellow Pointer Arrow pointing down */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 animate-[bounce_1s_infinite]">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold font-mono text-[#f59e0b] uppercase tracking-wider bg-black/80 px-2 py-0.5 rounded-full border border-[#f59e0b]/40">
                    Select Offer
                  </span>
                  <span className="text-3xl font-black text-[#f59e0b]">↓</span>
                </div>
              </div>

              {/* Fanning Out 3D Card Stack */}
              {[
                { title: "20% VIP Access Setup", cta: "Claim VIP Access", rot: "-12deg", tx: "-50px", ty: "20px", bg: "from-[#112d1b] to-[#07160d]" },
                { title: "Complimentary Funnel Audit", cta: "Book 15-Min Audit", rot: "-5deg", tx: "-20px", ty: "10px", bg: "from-[#193a27] to-[#0b1d13]" },
                { title: "VIP Client Growth Accelerator", cta: "Claim 20% VIP Access", rot: "6deg", tx: "30px", ty: "0px", bg: "from-[#224b33] to-[#0e271a]" },
              ].map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    transform: `rotate(${card.rot}) translateX(${card.tx}) translateY(${card.ty}) translateZ(${idx * 25}px)`,
                  }}
                  className={`absolute w-72 sm:w-80 rounded-2xl border border-white/20 bg-gradient-to-br ${card.bg} p-5 shadow-[0_25px_60px_rgba(0,0,0,0.7)] transition-all duration-700 hover:scale-105 cursor-pointer`}
                  onClick={() => handleActionClick("offer")}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#1DB954]/20 px-2.5 py-0.5 text-[9px] font-bold text-[#86edaa] uppercase">
                      Offer #0{idx + 1}
                    </span>
                    <Gift className="h-4 w-4 text-[#1DB954]" />
                  </div>
                  <h4 className="mt-3 text-base font-bold text-white">{card.title}</h4>
                  <p className="mt-1 text-[11px] text-[#8e9d95]">Complete outbound setup & automated follow-ups</p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
                    <span className="text-[#67776e]">Active Offer</span>
                    <span className="font-bold text-[#86edaa]">{card.cta} →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SCENE 2: 3D Platform Box & Integrated Orbit (Inspo: Amazon Product Box) */}
          {currentScene.id === "scene_box" && (
            <div className="relative w-full max-w-lg flex items-center justify-center h-64 [transform-style:preserve-3d]">
              {/* Revolving 3D Launchr Platform Box in Center */}
              <div className="relative h-28 w-56 rounded-2xl border-2 border-[#1DB954] bg-gradient-to-r from-[#122b1c] via-[#0d1e14] to-[#07130c] p-4 shadow-[0_0_50px_rgba(29,185,84,0.4)] flex flex-col justify-between items-center text-center [transform:rotateX(15deg)_rotateY(-10deg)]">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#1DB954]" />
                  <span className="text-lg font-black text-white tracking-tight">Launchr</span>
                </div>
                <p className="text-[10px] text-[#86edaa] font-mono">ALL-IN-ONE ACQUISITION</p>
                <div className="w-full h-1 bg-[#1DB954] rounded-full animate-pulse" />
              </div>

              {/* Orbiting Integrated Channels */}
              {[
                { label: "Google Grounded AI", icon: Compass, top: "10%", left: "10%", color: "border-sky-500/40 text-sky-400" },
                { label: "WhatsApp Web", icon: MessageCircle, top: "10%", left: "65%", color: "border-emerald-500/40 text-emerald-400" },
                { label: "Email Outbound", icon: Mail, top: "65%", left: "15%", color: "border-blue-500/40 text-blue-400" },
                { label: "SMS Dispatch", icon: Phone, top: "65%", left: "65%", color: "border-amber-500/40 text-amber-400" },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    style={{ top: item.top, left: item.left }}
                    className={`absolute flex items-center gap-2 rounded-xl border ${item.color} bg-black/80 px-3 py-2 shadow-2xl backdrop-blur animate-pulse`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-bold text-white">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* SCENE 3: 3D Animated Clock & Live Search Scanner (Inspo: Amazon Same Day Clock) */}
          {currentScene.id === "scene_delivery" && (
            <div className="relative w-full max-w-lg flex items-center justify-center h-64 [transform-style:preserve-3d]">
              {/* 3D Animated Scanner Clock in Center */}
              <div className="relative h-44 w-44 rounded-full border-4 border-[#1DB954]/40 bg-[#091510] flex items-center justify-center shadow-[0_0_60px_rgba(29,185,84,0.3)] animate-pulse">
                <Clock className="h-16 w-16 text-[#1DB954]" />
                <div className="absolute inset-2 rounded-full border border-dashed border-[#1DB954]/30 animate-[spin_12s_linear_infinite]" />
              </div>

              {/* Yellow Pointer Arrow pointing to verified company */}
              <div className="absolute top-4 right-12 z-30 animate-bounce">
                <span className="text-2xl font-black text-[#f59e0b]">↙</span>
              </div>

              {/* Discovered Real Company Badges floating around */}
              {[
                { name: "CloudScale Digital", role: "CEO", loc: "Austin, TX", top: "15%", left: "5%", rot: "-6deg" },
                { name: "Apex Solutions Co", role: "Managing Director", loc: "Austin, TX", top: "50%", left: "55%", rot: "6deg" },
              ].map((card, idx) => (
                <div
                  key={idx}
                  style={{ top: card.top, left: card.left, transform: `rotate(${card.rot})` }}
                  className="absolute w-56 rounded-xl border border-white/20 bg-[#0e1913]/90 p-3.5 shadow-2xl backdrop-blur transition-all duration-300 hover:scale-105 cursor-pointer"
                  onClick={() => handleActionClick("finder")}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate">{card.name}</span>
                    <span className="rounded-full bg-[#1DB954]/20 px-2 py-0.5 text-[9px] font-bold text-[#86edaa]">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1DB954] font-medium mt-0.5">{card.role}</p>
                  <p className="text-[10px] text-[#6d7b73]">{card.loc} • Live Grounded Lead</p>
                </div>
              ))}
            </div>
          )}

          {/* SCENE 4: Domino Cascade 3D Pipeline Cards (Inspo: Amazon My Orders Dominoes) */}
          {currentScene.id === "scene_pipeline" && (
            <div className="relative w-full max-w-lg flex items-center justify-center gap-2.5 h-64 [transform-style:preserve-3d]">
              {[
                { stage: "Stage 01", label: "Inquiry", status: "New Prospect", active: false },
                { stage: "Stage 02", label: "Outreach Sent", status: "WhatsApp Sent", active: false },
                { stage: "Stage 03", label: "Prospect Reply", status: "Price Check", active: false },
                { stage: "Stage 04", label: "Meeting Booked", status: "Lead Converted", active: true },
              ].map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    transform: `rotateY(${-18 + idx * 10}deg) translateZ(${idx * 20}px)`,
                  }}
                  className={`w-36 sm:w-40 rounded-2xl border p-4 shadow-2xl transition-all duration-500 hover:scale-105 cursor-pointer ${
                    card.active
                      ? "border-2 border-[#1DB954] bg-[#122e1e] shadow-[0_0_40px_rgba(29,185,84,0.4)]"
                      : "border-white/10 bg-[#0e1713]"
                  }`}
                  onClick={() => handleActionClick("inbox")}
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      card.active ? "bg-[#1DB954] text-[#06130a]" : "bg-white/10 text-white"
                    }`}
                  >
                    {card.stage}
                  </span>
                  <h5 className="mt-3 text-xs font-bold text-white">{card.label}</h5>
                  <div className="mt-4 border-t border-white/10 pt-2 text-[10px]">
                    <span className={card.active ? "text-[#86edaa] font-bold" : "text-[#707e76]"}>
                      {card.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Interactive Progress Bar & Media Controls */}
        <div className="relative z-20 space-y-3 border-t border-white/10 pt-4">
          {/* Timeline Seekbar */}
          <div className="relative flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={totalDuration}
              value={currentTime}
              onChange={handleSeek}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-[#1DB954] focus:outline-none"
            />
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs text-[#8f9a93]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1DB954] text-[#06130a] hover:bg-[#32d76a] transition shadow-[0_0_20px_rgba(29,185,84,0.4)]"
                title={isPlaying ? "Pause Showcase" : "Play Showcase"}
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition text-white"
                title="Restart Showcase"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <span className="font-mono text-[11px] text-[#cbd4ce]">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={playbackSpeed}
                onChange={e => setPlaybackSpeed(Number(e.target.value))}
                className="rounded-xl border border-white/10 bg-[#121a17] px-2.5 py-1 text-[11px] text-white focus:outline-none"
              >
                <option value={1}>1.0x Speed</option>
                <option value={1.25}>1.25x Speed</option>
                <option value={1.5}>1.5x Speed</option>
                <option value={2}>2.0x Speed</option>
              </select>

              <button
                onClick={toggleFullscreen}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition text-white"
                title="Fullscreen Mode"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
