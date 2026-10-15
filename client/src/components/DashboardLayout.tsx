import { useAuth } from "@/_core/hooks/useAuth";
import { useLaunchr } from "@/contexts/LaunchrContext";
import { AuthModal } from "@/components/AuthModal";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Gift,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Megaphone,
  MessageCircleMore,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Prospects", path: "/customers", icon: Users },
  { label: "Offers", path: "/offers", icon: Gift },
  { label: "Outreach", path: "/campaigns", icon: Megaphone },
  { label: "Conversations", path: "/conversations", icon: MessageCircleMore },
  { label: "Leads", path: "/leads", icon: Target },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signin");
  const { profile } = useLaunchr();
  const { user, logout, isAuthenticated } = useAuth();
  const workspaceName = profile.name || user?.name || "Launchr Workspace";
  const page = [...navigation, { label: "Profile", path: "/profile", icon: UserRound }, { label: "Settings", path: "/settings", icon: Settings }].find(item => item.path === location)?.label ?? (location.startsWith("/customers/imports/") ? "CSV Import" : "Dashboard");
  const initials = useMemo(() => workspaceName.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase() || "LW", [workspaceName]);

  const openAuth = (tab: "signin" | "signup" = "signin") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#070b0a] text-[#f2f5f3] selection:bg-[#1DB954]/35">
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/65 md:hidden"
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[0.075] bg-[#090d0c] px-3 py-4 transition-[width,transform] duration-200 ease-out max-md:!w-[248px] ${
          mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        } ${collapsed ? "w-[76px]" : "w-[248px]"}`}
      >
        <div
          className={`mb-8 flex h-10 items-center ${
            collapsed ? "justify-center" : "justify-between px-2"
          }`}
        >
          <Link href="/" className="group flex items-center gap-2.5 focus:outline-none">
            <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-[#1DB954] text-[#06150c] shadow-[0_0_24px_rgba(29,185,84,.24)] transition-transform duration-200 group-hover:scale-105">
              <Zap className="h-4 w-4 fill-current" strokeWidth={2.5} />
            </span>
            {!collapsed && <span className="text-[20px] font-bold tracking-[-0.05em]">launchr</span>}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="grid h-7 w-7 place-items-center rounded-md text-[#9ba49f] transition hover:bg-white/[0.07] hover:text-white"
              aria-label="Collapse navigation"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="space-y-1" aria-label="Primary navigation">
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#58615c]">
              Sales Pipeline
            </p>
          )}
          {navigation.map(item => {
            const active = location === item.path;
            const Icon = item.icon;
            return (
              <Link
                onClick={() => setMobileOpen(false)}
                key={item.path}
                href={item.path}
                title={collapsed ? item.label : undefined}
                className={`group flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] ${
                  active
                    ? "bg-[#1DB954] text-[#06150c] shadow-[0_6px_18px_rgba(29,185,84,.16)] font-semibold"
                    : "text-[#a2aaa6] hover:bg-white/[0.055] hover:text-[#edf1ef]"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon
                  className={`h-[17px] w-[17px] shrink-0 ${
                    active ? "" : "transition-transform duration-200 group-hover:scale-110"
                  }`}
                  strokeWidth={active ? 2.6 : 2}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-white/[0.07] pt-4">
          <Link
            onClick={() => setMobileOpen(false)}
            href="/profile"
            title={collapsed ? "Profile" : undefined}
            className={`group flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200 ${
              location === "/profile"
                ? "bg-white/[0.09] text-white"
                : "text-[#a2aaa6] hover:bg-white/[0.055] hover:text-white"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <UserRound className="h-[17px] w-[17px]" />
            {!collapsed && <span>Profile</span>}
          </Link>
          <Link
            onClick={() => setMobileOpen(false)}
            href="/settings"
            title={collapsed ? "Settings" : undefined}
            className={`group flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200 ${
              location === "/settings"
                ? "bg-white/[0.09] text-white"
                : "text-[#a2aaa6] hover:bg-white/[0.055] hover:text-white"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Settings className="h-[17px] w-[17px] transition-transform duration-200 group-hover:rotate-12" />
            {!collapsed && <span>Settings</span>}
          </Link>

          <div
            className={`mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/[0.045] p-2.5 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <button
              onClick={() => openAuth("signin")}
              className="flex min-w-0 items-center gap-2.5 text-left"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d5f5ab] to-[#1DB954] text-[10px] font-bold text-[#092010]">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[#eef2ef]">
                    {workspaceName}
                  </p>
                  <p className="truncate text-[10px] text-[#7f8984]">
                    {user?.email || profile.type || "Active Workspace"}
                  </p>
                </div>
              )}
            </button>
            {!collapsed && (
              <button
                onClick={isAuthenticated ? () => logout() : () => openAuth("signin")}
                className="rounded p-1 text-[#8f9a93] hover:bg-white/[0.08] hover:text-white transition"
                title={isAuthenticated ? "Sign out" : "Sign in"}
              >
                {isAuthenticated ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="mt-3 grid h-9 w-full place-items-center rounded-xl text-[#8f9993] transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Expand navigation"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      <main
        className={`min-h-screen transition-[margin] duration-200 max-md:ml-0 ${
          collapsed ? "ml-[76px]" : "ml-[248px]"
        }`}
      >
        <header className="sticky top-0 z-30 flex h-[73px] items-center justify-between border-b border-white/[0.06] bg-[#070b0a]/85 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-[#dce4df] md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#69736e]">
                {workspaceName}
              </p>
              <h1 className="mt-0.5 text-[18px] font-semibold tracking-[-0.035em] text-[#f4f6f5]">
                {page}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full border border-[#1DB954]/30 bg-[#1DB954]/10 px-3 py-1.5 text-[11px] font-semibold text-[#86edaa] sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                  <span>{user?.email || user?.name || "Connected"}</span>
                </span>
                <button
                  onClick={() => logout()}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#8f9a93] hover:text-white transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuth("signin")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1DB954]/30 bg-[#1DB954]/10 px-3.5 py-1.5 text-[12px] font-semibold text-[#86edaa] transition hover:bg-[#1DB954]/20"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
            <button
              onClick={() => (isAuthenticated ? undefined : openAuth("signin"))}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.12] bg-[#111715] text-[11px] font-bold text-[#cbe4d2]"
            >
              {initials}
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1580px] px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
    </div>
  );
}
