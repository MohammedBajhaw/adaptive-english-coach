// The vocabulary cards come from data/Mechatronics_Robotics_Vocabulary_Complete.xlsx.
// Run `python3 tools/import-vocabulary.py` after editing the spreadsheet to regenerate the data file below.

export type BankLevel = "Beginner" | "Intermediate" | "Advanced";

export type BankTerm = {
  id: string;
  term: string;
  ar: string;
  pron: string;
  cat: string;
  def: string;
  ex: Array<{ en: string; ar: string }>;
  level: BankLevel;
  stage: number;
  prio: boolean;
  qa: string[];
  src: string;
};

export type VocabularyBank = { stages: Array<{ n: number; en: string; ar: string }>; terms: BankTerm[] };

let bankPromise: Promise<VocabularyBank> | null = null;

// Loaded on demand: the data file is a separate chunk, so pages that never show cards do not download it.
export function loadVocabularyBank() {
  bankPromise ??= import("@/data/vocabulary-bank.json").then(module => module.default as VocabularyBank);
  return bankPromise;
}

export const levelLabels: Record<BankLevel, string> = { Beginner: "مبتدئ", Intermediate: "متوسط", Advanced: "متقدم" };

export const isBankId = (id: string | null | undefined) => /^S\d-[A-Z]{4}-\d{3}$/.test(id ?? "");

// New words are introduced in curriculum order (stage, then level), skipping the ones the learner already has.
export function pickNewTerms(terms: BankTerm[], knownIds: Set<string | null>, count: number) {
  return terms.filter(term => !knownIds.has(term.id)).slice(0, Math.max(0, count));
}

// The identity columns stored for a new card; everything shown on screen is read from the bank by content_id.
export function cardRowFor(term: BankTerm) {
  return {
    content_id: term.id,
    term: term.term,
    arabic_meaning: term.ar,
    part_of_speech: "",
    ipa: term.pron,
    engineering_domain: term.cat,
    examples: term.ex.map(example => ({ english: example.en, arabic: example.ar })),
  };
}

// Display data always comes from the bank, so a corrected word shows up even on cards created earlier.
export function decorateCard<T extends { content_id?: string | null }>(row: T, bank: VocabularyBank) {
  const term = bank.terms.find(item => item.id === row.content_id);
  if (!term) return row;
  const stage = bank.stages.find(item => item.n === term.stage);
  return {
    ...row,
    term: term.term,
    arabic_meaning: term.ar,
    pronunciation: term.pron,
    category: term.cat,
    definition: term.def,
    examples: term.ex.map(example => ({ english: example.en, arabic: example.ar })),
    level: term.level,
    stageName: stage?.ar ?? "",
    interviewPriority: term.prio,
  };
}
