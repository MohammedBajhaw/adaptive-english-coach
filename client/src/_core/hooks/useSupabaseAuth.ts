import { setLearnerStartDateIfMissing } from "@/lib/localLessons";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

// The start date must be known before the user state is published, so lesson pages that
// re-render on the user pick the right curriculum day.
function publish(next: User | null, setUser: (user: User | null) => void) {
  if (next?.created_at) setLearnerStartDateIfMissing(next.created_at);
  setUser(next);
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => {
      publish(data.user ?? null, setUser);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      publish(session?.user ?? null, setUser);
      setLoading(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const supabase = getSupabase();
    // Always return to the app root: that is the Redirect URL registered in Supabase.
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
  }, []);

  // The installed web app cannot receive the email link (it opens in the browser), so the same email also carries a code.
  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    const supabase = getSupabase();
    return supabase.auth.verifyOtp({ email, token, type: "email" });
  }, []);

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await getSupabase().auth.signOut();
  }, []);

  return { user, loading, isAuthenticated: Boolean(user), isConfigured: isSupabaseConfigured, signInWithEmail, verifyEmailCode, logout };
}
