// Vocabulary session rules: the session keeps introducing new words until their combined "load" reaches the budget.
// Everything here is pure (no network, no React) so the rules can be tested exactly.

export type Rating = "again" | "hard" | "good" | "easy";

// Integer units avoid decimal rounding: the budget is the lowest common multiple of 7, 10 and 15,
// so 7 "again" or 10 "hard" or 15 "good" reach it exactly. "easy" costs nothing.
export const RATING_UNITS: Record<Rating, number> = { again: 30, hard: 21, good: 14, easy: 0 };
export const BUDGET_UNITS = 210;
export const MAX_NEW_PER_CYCLE = 100;
export const EASY_RETURN_HOURS = 21 * 24; // easy words come back once, after three weeks
export const DEFAULT_REVIEW_HOURS = 2;

export const ratingLabels: Record<Rating, string> = { again: "لم أتذكر", hard: "صعبة", good: "جيدة", easy: "سهلة" };
export const ratingOrder: Rating[] = ["again", "hard", "good", "easy"];

export const isRating = (value: unknown): value is Rating => value === "again" || value === "hard" || value === "good" || value === "easy";

// Load of the new words rated so far: only the FIRST rating of each new word counts.
export function loadUnits(intakeRatings: Array<Rating | null | undefined>) {
  return intakeRatings.reduce<number>((total, rating) => total + (rating ? RATING_UNITS[rating] : 0), 0);
}

export const loadPercent = (units: number) => Math.min(100, Math.round((units / BUDGET_UNITS) * 100));

export type StopReason = "budget" | "cap" | "closed" | "exhausted";

// New words stop for the rest of the cycle when the budget is spent, the safety cap is hit,
// the learner closed the session, or the whole word list has been introduced.
export function stopReason(input: { units: number; newCount: number; closed: boolean; remainingWords: number }): StopReason | null {
  if (input.units >= BUDGET_UNITS) return "budget";
  if (input.newCount >= MAX_NEW_PER_CYCLE) return "cap";
  if (input.closed) return "closed";
  if (input.remainingWords <= 0) return "exhausted";
  return null;
}

// Every word that is not easy comes back at the same fixed interval (the reminder interval); easy words leave for three weeks.
export function reviewDelayHours(rating: Rating, intervalHours = DEFAULT_REVIEW_HOURS) {
  return rating === "easy" ? EASY_RETURN_HOURS : intervalHours;
}

// Strength only feeds the "strong cards" report; it does not schedule anything.
export function nextStrength(rating: Rating, strength: number) {
  return Math.max(0, strength + { again: 0, hard: 1, good: 2, easy: 3 }[rating]);
}

export type SessionCard = {
  id: string;
  content_id?: string | null;
  review_count?: number | null;
  next_review_at: string;
  intake_rating?: Rating | null;
  intake_at?: string | null;
  last_rating?: Rating | null;
  last_reviewed_at?: string | null;
};

// The words of the current cycle: introduced in it or reviewed in it.
export function cycleWords<T extends SessionCard>(cards: T[], openedAt: string | null) {
  if (!openedAt) return [];
  return cards
    .filter(card => (card.intake_at && card.intake_at >= openedAt) || (card.last_reviewed_at && card.last_reviewed_at >= openedAt))
    .sort((a, b) => (b.last_reviewed_at ?? b.intake_at ?? "").localeCompare(a.last_reviewed_at ?? a.intake_at ?? ""));
}

export function deriveSession<T extends SessionCard>(input: { cards: T[]; openedAt: string | null; closed: boolean; totalWords: number; now: Date }) {
  const nowIso = input.now.toISOString();
  const introduced = input.cards.filter(card => card.intake_at && input.openedAt && card.intake_at >= input.openedAt);
  const units = loadUnits(introduced.map(card => card.intake_rating));
  // Cards shown but not rated yet continue the new-word flow; rated cards that are due again are reviews.
  const pendingNew = input.cards.filter(card => !card.review_count && card.next_review_at <= nowIso);
  const dueReviews = input.cards
    .filter(card => !!card.review_count && card.next_review_at <= nowIso)
    .sort((a, b) => a.next_review_at.localeCompare(b.next_review_at));
  const reason = stopReason({ units, newCount: introduced.length, closed: input.closed, remainingWords: input.totalWords - input.cards.length });
  return { units, percent: loadPercent(units), newCount: introduced.length, pendingNew, dueReviews, stopReason: reason, stopped: reason !== null };
}
