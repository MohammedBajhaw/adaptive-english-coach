// The wake cycle is the "day" of the whole app: tasks, the daily lesson, the vocabulary session and the reminders
// all follow it instead of the calendar date. A cycle starts when the learner wakes up and lasts `hours` (18 by default).
// The rules are pure functions; a tiny store keeps the current cycle in memory and localStorage so pages can read it synchronously.

export type CycleState = {
  number: number;           // 1, 2, 3... (0 = not started yet); the daily lesson is number - 1
  openedAt: string | null;  // when the cycle was really opened (the "I woke up" tap): evidence and vocabulary windows start here
  startedAt: string | null; // nominal wake time, adjustable: reminders and the 18-hour clock count from here
  dateKey: string | null;   // YYYY-MM-DD label used as daily_tasks.date_key (unique and increasing)
  hours: number;
};

export const DEFAULT_CYCLE_HOURS = 18;
export const MIN_HOURS_BEFORE_WAKE = 6;
const HOUR = 3_600_000;
const STORAGE_KEY = "aec.cycle";

const pad = (value: number) => String(value).padStart(2, "0");

// Calendar date in the device's own time zone.
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

// The new cycle's date label: the local date it starts on, but never the same or an earlier label than the previous cycle,
// so the unique (user, date_key, task_key) rule never collides.
export function nextCycleDateKey(startAt: Date, previousKey: string | null) {
  const local = localDateKey(startAt);
  if (!previousKey) return local;
  const minimum = addDays(previousKey, 1);
  return local > minimum ? local : minimum;
}

export const cycleEndsAt = (state: CycleState) => (state.startedAt ? new Date(Date.parse(state.startedAt) + state.hours * HOUR) : null);

export function cycleEnded(state: CycleState, now: Date) {
  const end = cycleEndsAt(state);
  return end !== null && now.getTime() >= end.getTime();
}

export function hoursSinceStart(state: CycleState, now: Date) {
  return state.startedAt ? (now.getTime() - Date.parse(state.startedAt)) / HOUR : Infinity;
}

// Pressing "I woke up" very early in a cycle is probably a mistake (it advances the lesson), so it asks first.
export function canWakeWithoutConfirm(state: CycleState, now: Date) {
  return state.number === 0 || hoursSinceStart(state, now) >= MIN_HOURS_BEFORE_WAKE;
}

// The nominal start may be moved between 24 hours ago and 12 hours ahead.
export function isStartInRange(candidate: Date, now: Date) {
  const offset = candidate.getTime() - now.getTime();
  return offset >= -24 * HOUR && offset <= 12 * HOUR;
}

// "04:00" -> the occurrence of that clock time closest to now inside the allowed range.
export function clockTimeNear(hour: number, minute: number, now: Date) {
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (candidate.getTime() > now.getTime() + 12 * HOUR) candidate.setDate(candidate.getDate() - 1);
  else if (candidate.getTime() < now.getTime() - 24 * HOUR) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

export function startNewCycle(previous: { number: number; dateKey: string | null; hours?: number }, startAt: Date, now: Date): CycleState {
  return {
    number: previous.number + 1,
    openedAt: now.toISOString(),
    startedAt: startAt.toISOString(),
    dateKey: nextCycleDateKey(startAt, previous.dateKey),
    hours: previous.hours ?? DEFAULT_CYCLE_HOURS,
  };
}

// Learners from before the wake cycle keep their place in the curriculum: the first cycle takes the old day number.
export function legacyCycleNumber(profileCreatedAt: string, now: Date) {
  const days = Math.floor((now.getTime() - Date.parse(profileCreatedAt)) / (24 * HOUR));
  return Math.max(1, days + 1);
}

type ProfileCycleColumns = {
  cycle_number?: number | null;
  cycle_opened_at?: string | null;
  cycle_started_at?: string | null;
  cycle_date_key?: string | null;
  cycle_hours?: number | null;
};

export function cycleFromProfile(profile: ProfileCycleColumns): CycleState | null {
  if (!profile.cycle_number || !profile.cycle_started_at) return null;
  return {
    number: profile.cycle_number,
    openedAt: profile.cycle_opened_at ?? profile.cycle_started_at,
    startedAt: profile.cycle_started_at,
    dateKey: profile.cycle_date_key ?? localDateKey(new Date(profile.cycle_started_at)),
    hours: profile.cycle_hours ?? DEFAULT_CYCLE_HOURS,
  };
}

export const cycleToProfile = (state: CycleState) => ({
  cycle_number: state.number,
  cycle_opened_at: state.openedAt,
  cycle_started_at: state.startedAt,
  cycle_date_key: state.dateKey,
  cycle_hours: state.hours,
});

// ---- store ----------------------------------------------------------------
const emptyState: CycleState = { number: 0, openedAt: null, startedAt: null, dateKey: null, hours: DEFAULT_CYCLE_HOURS };

function readStored(): CycleState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<CycleState>;
    return typeof parsed.number === "number" ? { ...emptyState, ...parsed } : emptyState;
  } catch {
    return emptyState;
  }
}

let current: CycleState = readStored();
const listeners = new Set<() => void>();

export const getCycle = () => current;

export function setCycle(next: CycleState) {
  current = next;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  listeners.forEach(listener => listener());
}

export function subscribeCycle(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The label for daily_tasks.date_key: the current cycle's, or today's local date before any cycle exists.
export const currentDateKey = () => current.dateKey ?? localDateKey(new Date());
