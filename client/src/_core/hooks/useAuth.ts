import { useSupabaseAuth } from "@/_core/hooks/useSupabaseAuth";
import { useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const supabaseAuth = useSupabaseAuth();

  const state = useMemo(() => {
    return {
      user: supabaseAuth.user
        ? { ...supabaseAuth.user, name: supabaseAuth.user.user_metadata.full_name ?? supabaseAuth.user.email ?? "متعلم" }
        : null,
      loading: supabaseAuth.loading,
      error: null,
      isAuthenticated: supabaseAuth.isAuthenticated,
    };
  }, [supabaseAuth.isAuthenticated, supabaseAuth.loading, supabaseAuth.user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (supabaseAuth.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }, [redirectOnUnauthenticated, redirectPath, state.user, supabaseAuth.loading]);

  return {
    ...state,
    refresh: () => undefined,
    logout: supabaseAuth.logout,
    signInWithEmail: supabaseAuth.signInWithEmail,
    isConfigured: supabaseAuth.isConfigured,
  };
}
