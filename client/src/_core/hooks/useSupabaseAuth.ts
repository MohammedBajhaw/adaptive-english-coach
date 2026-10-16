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
  // True after the learner opens a password-reset link: the app then asks for a new password.
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => {
      publish(data.user ?? null, setUser);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
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

  // Email + password works inside the installed phone app and needs no email delivery.
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    return getSupabase().auth.signInWithPassword({ email, password });
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    return getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } });
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    return getSupabase().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL });
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const result = await getSupabase().auth.updateUser({ password });
    if (!result.error) setRecovery(false);
    return result;
  }, []);

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await getSupabase().auth.signOut();
  }, []);

  return { user, loading, isAuthenticated: Boolean(user), isConfigured: isSupabaseConfigured, signInWithEmail, signInWithPassword, signUpWithPassword, requestPasswordReset, updatePassword, recovery, dismissRecovery: () => setRecovery(false), logout };
}
