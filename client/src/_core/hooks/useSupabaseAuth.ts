import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const supabase = getSupabase();
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
  }, []);

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await getSupabase().auth.signOut();
  }, []);

  return { user, loading, isAuthenticated: Boolean(user), isConfigured: isSupabaseConfigured, signInWithEmail, logout };
}
