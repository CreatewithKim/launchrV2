import { trpc } from "@/lib/trpc";
import { authClient, useSession } from "@/lib/auth-client";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const session = useSession();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const refresh = useCallback(async () => {
    await Promise.allSettled([
      meQuery.refetch(),
      utils.auth.me.invalidate(),
    ]);
  }, [meQuery, utils]);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch (_e) {
      // ignore client signout errors
    }
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
    } finally {
      utils.auth.me.setData(undefined, null);
      await refresh();
    }
  }, [logoutMutation, refresh, utils]);

  const signInWithEmail = useCallback(
    async (params: { email: string; password: string }) => {
      const res = await authClient.signIn.email({
        email: params.email,
        password: params.password,
      });
      await refresh();
      return res;
    },
    [refresh]
  );

  const signUpWithEmail = useCallback(
    async (params: { email: string; password: string; name: string }) => {
      const res = await authClient.signUp.email({
        email: params.email,
        password: params.password,
        name: params.name,
      });
      await refresh();
      return res;
    },
    [refresh]
  );

  const signInWithSocial = useCallback(
    async (provider: "google" | "github") => {
      return authClient.signIn.social({
        provider,
        callbackURL: window.location.origin,
      });
    },
    []
  );

  const activeUser = useMemo(() => {
    if (meQuery.data) return meQuery.data;
    if (session.data?.user) {
      return {
        id: typeof session.data.user.id === "number" ? session.data.user.id : 1,
        openId: session.data.user.id || "better_auth_user",
        name: session.data.user.name || "Launchr Member",
        email: session.data.user.email || "",
        loginMethod: "better-auth",
        role: "user" as const,
        createdAt: new Date(session.data.user.createdAt || Date.now()),
        updatedAt: new Date(session.data.user.updatedAt || Date.now()),
        lastSignedIn: new Date(),
      };
    }
    return null;
  }, [meQuery.data, session.data?.user]);

  const isAuthenticated = Boolean(activeUser);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || session.isPending) return;
    if (isAuthenticated) return;

    if (typeof window === "undefined") return;
    if (window.location.pathname === "/login" || window.location.pathname === "/signup") return;

    const target = redirectPath ?? "/login";
    window.location.href = target;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    isAuthenticated,
    meQuery.isLoading,
    session.isPending,
  ]);

  return {
    user: activeUser,
    loading: meQuery.isLoading || session.isPending,
    error: meQuery.error ?? null,
    isAuthenticated,
    refresh,
    logout,
    signInWithEmail,
    signUpWithEmail,
    signInWithSocial,
  };
}
