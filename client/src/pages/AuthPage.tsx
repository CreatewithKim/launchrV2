import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { AuthModal } from "@/components/AuthModal";
import { ShieldCheck, Zap } from "lucide-react";

export function AuthPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [modalOpen, setModalOpen] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070b0a] p-4 text-[#f2f5f3]">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1DB954] text-[#06150c] shadow-[0_0_30px_rgba(29,185,84,0.35)]">
          <Zap className="h-6 w-6 fill-current" strokeWidth={2.5} />
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          Welcome to Launchr
        </h1>
        <p className="mt-1 text-xs text-[#8f9a93]">
          AI-powered customer acquisition, prospect finding, and outreach
        </p>
      </div>

      <AuthModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setLocation("/");
        }}
        defaultTab="signin"
      />
    </div>
  );
}
