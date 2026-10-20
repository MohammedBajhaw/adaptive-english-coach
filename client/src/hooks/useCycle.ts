import { getCycle, subscribeCycle } from "@/lib/cycle";
import { useSyncExternalStore } from "react";

// The current wake cycle; components re-render when it changes (after "I woke up" or when the profile loads).
export const useCycle = () => useSyncExternalStore(subscribeCycle, getCycle, getCycle);
