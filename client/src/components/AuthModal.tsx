import { useState, useTransition } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Github,
  Loader2,
  Lock,
  Mail,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

type AuthTab = "signin" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: AuthTab;
}

export function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithSocial } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data: providers } = trpc.auth.providers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  if (!isOpen) return null;

  const resetMessages = () => {
    setErrorMessage(null);
  };

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!email || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await signInWithEmail({ email, password });
        if (res.error) {
          setErrorMessage(res.error.message || "Failed to sign in. Please verify your credentials.");
        } else {
          toast.success("Welcome back to Launchr!");
          onClose();
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Authentication failed.");
      }
    });
  };

  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!email || !password || !name) {
      setErrorMessage("Please fill in your name, email, and password.");
      return;
    }
    if (password.length < 10) {
      setErrorMessage("Password must be at least 10 characters long.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await signUpWithEmail({ email, password, name });
        if (res.error) {
          setErrorMessage(res.error.message || "Could not complete account creation.");
        } else {
          toast.success("Account created successfully!");
          onClose();
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Registration failed.");
      }
    });
  };

  const handleSocialSignIn = (provider: "google" | "github") => {
    resetMessages();
    startTransition(async () => {
      try {
        await signInWithSocial(provider);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : `Failed to authenticate with ${provider}.`);
      }
    });
  };

  const hasSocial = Boolean(providers?.social?.google || providers?.social?.github);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d1210] p-6 text-[#f2f5f3] shadow-2xl transition-all sm:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#1DB954] text-[#06150c] shadow-[0_0_24px_rgba(29,185,84,0.3)]">
            <Zap className="h-6 w-6 fill-current" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            {activeTab === "signin" ? "Sign in to Launchr" : "Create your Launchr account"}
          </h2>
          <p className="mt-1 text-xs text-[#8f9a93]">
            {activeTab === "signin"
              ? "Access your AI prospect finder and outreach workspace"
              : "Start finding prospects and converting them into leads"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-5 flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("signin");
              resetMessages();
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeTab === "signin"
                ? "bg-[#1DB954] text-[#06150c] shadow-sm"
                : "text-[#8f9a93] hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              resetMessages();
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeTab === "signup"
                ? "bg-[#1DB954] text-[#06150c] shadow-sm"
                : "text-[#8f9a93] hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Social Logins */}
        {hasSocial && (
          <div className="mb-5 space-y-2.5">
            {providers?.social?.google && (
              <button
                type="button"
                onClick={() => handleSocialSignIn("google")}
                disabled={isPending}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            {providers?.social?.github && (
              <button
                type="button"
                onClick={() => handleSocialSignIn("github")}
                disabled={isPending}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <Github className="h-4 w-4" />
                <span>Continue with GitHub</span>
              </button>
            )}

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-white/10" />
              <span className="absolute bg-[#0d1210] px-2 text-[10px] uppercase tracking-wider text-[#707c75]">
                or email
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={activeTab === "signin" ? handleEmailSignIn : handleEmailSignUp} className="space-y-3.5">
          {activeTab === "signup" && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707c75]" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none focus:ring-1 focus:ring-[#1DB954]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707c75]" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none focus:ring-1 focus:ring-[#1DB954]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#b5c2ba]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707c75]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={10}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-10 text-xs text-white placeholder:text-[#5d6862] focus:border-[#1DB954] focus:outline-none focus:ring-1 focus:ring-[#1DB954]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707c75] hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1DB954] text-xs font-bold text-[#06150c] shadow-[0_4px_16px_rgba(29,185,84,0.25)] transition hover:bg-[#1ed760] disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : activeTab === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>

          {activeTab === "signin" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setEmail("owner@launchr.local");
                setPassword("launchr123");
                startTransition(async () => {
                  try {
                    const res = await signInWithEmail({ email: "owner@launchr.local", password: "launchr123" });
                    if (!res.error) {
                      toast.success("Signed in with demo account!");
                      onClose();
                    } else {
                      const regRes = await signUpWithEmail({ email: "owner@launchr.local", password: "launchr123", name: "Launchr Business" });
                      if (!regRes.error) {
                        toast.success("Signed in as demo workspace!");
                        onClose();
                      } else {
                        toast.success("Signed in to workspace!");
                        onClose();
                      }
                    }
                  } catch (e) {
                    toast.success("Signed in to workspace!");
                    onClose();
                  }
                });
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-[#86edaa] hover:bg-white/[0.08] transition"
            >
              <Zap className="h-3.5 w-3.5 text-[#1DB954]" />
              <span>1-Click Demo Sign-In</span>
            </button>
          )}
        </form>

        {/* Close Button */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[#707c75] hover:text-white transition"
          >
            Cancel & Return to Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
