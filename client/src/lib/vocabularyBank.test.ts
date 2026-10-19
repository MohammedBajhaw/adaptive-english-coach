import { describe, expect, it } from "vitest";
import { cardRowFor, decorateCard, isBankId, loadVocabularyBank, pickNewTerms, type BankLevel } from "./vocabularyBank";

const arabic = /[؀-ۿ]/;
const levelOrder: BankLevel[] = ["Beginner", "Intermediate", "Advanced"];

describe("vocabulary bank (from the spreadsheet)", () => {
  it("كل مصطلح كامل البيانات: معنى عربي ونطق وتعريف ومثالان مترجمان", async () => {
    const { terms } = await loadVocabularyBank();
    expect(terms.length).toBeGreaterThan(0);
    for (const term of terms) {
      expect(term.term && term.pron && term.cat && term.def, term.id).toBeTruthy();
      expect(arabic.test(term.ar), `${term.id} arabic meaning`).toBe(true);
      expect(term.ex, term.id).toHaveLength(2);
      for (const example of term.ex) {
        expect(example.en && !arabic.test(example.en), `${term.id} english example`).toBe(true);
        expect(arabic.test(example.ar), `${term.id} arabic translation`).toBe(true);
      }
    }
  });

  it("المعرفات والمصطلحات فريدة والمراحل معرّفة", async () => {
    const { terms, stages } = await loadVocabularyBank();
    expect(new Set(terms.map(term => term.id)).size).toBe(terms.length);
    expect(new Set(terms.map(term => term.term.toLowerCase())).size).toBe(terms.length);
    expect(terms.every(term => isBankId(term.id))).toBe(true);
    const stageNumbers = new Set(stages.map(stage => stage.n));
    expect(terms.every(term => stageNumbers.has(term.stage))).toBe(true);
    expect(stages.every(stage => stage.en && arabic.test(stage.ar))).toBe(true);
  });

  it("الترتيب حسب المرحلة ثم المستوى (من المبتدئ إلى المتقدم)", async () => {
    const { terms } = await loadVocabularyBank();
    for (let index = 1; index < terms.length; index += 1) {
      const previous = terms[index - 1]!, current = terms[index]!;
      const before = previous.stage * 10 + levelOrder.indexOf(previous.level);
      const after = current.stage * 10 + levelOrder.indexOf(current.level);
      expect(after, `${previous.id} -> ${current.id}`).toBeGreaterThanOrEqual(before);
    }
  });
});

describe("card selection", () => {
  it("يقدّم الكلمات الجديدة بالترتيب ويتخطى ما يملكه المتعلم ويحترم الحد اليومي", async () => {
    const { terms } = await loadVocabularyBank();
    const first = pickNewTerms(terms, new Set(), 7);
    expect(first.map(term => term.id)).toEqual(terms.slice(0, 7).map(term => term.id));
    const next = pickNewTerms(terms, new Set(first.map(term => term.id)), 7);
    expect(next[0]!.id).toBe(terms[7]!.id);
    expect(pickNewTerms(terms, new Set(), 0)).toEqual([]);
    expect(pickNewTerms(terms, new Set(), -3)).toEqual([]);
  });

  it("يجهّز صف البطاقة بالأعمدة المطلوبة في قاعدة البيانات", async () => {
    const { terms } = await loadVocabularyBank();
    const row = cardRowFor(terms[0]!);
    expect(row.content_id).toBe(terms[0]!.id);
    expect(row.term && row.arabic_meaning && row.ipa && row.engineering_domain).toBeTruthy();
    expect(row.examples).toHaveLength(2);
    expect(Object.keys(row.examples[0]!)).toEqual(["english", "arabic"]);
  });

  it("تُقرأ بيانات العرض من الملف حتى لو كانت البطاقة القديمة تحمل نصًا مختلفًا", async () => {
    const bank = await loadVocabularyBank();
    const target = bank.terms[0]!;
    const stale = { content_id: target.id, term: "OLD WORD", arabic_meaning: "قديم", id: "row-1" };
    expect(decorateCard(stale, bank)).toMatchObject({ term: target.term, arabic_meaning: target.ar, definition: target.def, level: target.level, id: "row-1" });
    const unknown = { content_id: "vocabulary.w01.d01", term: "legacy" };
    expect(decorateCard(unknown, bank)).toBe(unknown);
  });
});
