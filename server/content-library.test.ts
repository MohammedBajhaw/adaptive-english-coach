import { describe, expect, it } from "vitest";
import { localContentPayloads } from "./content-library/library";

describe("حزمة المحتوى المحلي للأسابيع الستة الأولى", () => {
  it("تتضمن سبعة أيام لكل مهارة في كل أسبوع مع معرفات فريدة", () => {
    // weeks 1-4: 5 skills x 7 days = 35 items; weeks 5-6 add 7 vocabulary words per day (49) instead of 7.
    expect(localContentPayloads).toHaveLength(4 * 35 + 2 * (49 + 4 * 7));
    const ids = localContentPayloads.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const week of [1, 2, 3, 4, 5, 6]) {
      for (const skill of ["grammar", "listening", "speaking", "writing"]) {
        const items = localContentPayloads.filter(item => item.week === week && item.skill === skill);
        expect(items, `${skill} week ${week}`).toHaveLength(7);
        const prefix = skill === "speaking" ? "conversation" : skill;
        expect(items.map(item => item.id)).toEqual(Array.from({ length: 7 }, (_, index) => `${prefix}.w${String(week).padStart(2, "0")}.d${String(index + 1).padStart(2, "0")}`));
      }
      const vocabulary = localContentPayloads.filter(item => item.week === week && item.skill === "vocabulary");
      expect(vocabulary, `vocabulary week ${week}`).toHaveLength(week <= 4 ? 7 : 49);
    }
  });

  it("يقدم مفردات الأسبوعين الخامس والسادس سبع كلمات لكل يوم بلا تكرار للمصطلحات", () => {
    const terms = localContentPayloads.filter(item => item.skill === "vocabulary").map(item => item.contentMarkdown.match(/^Term:\s*(.+)$/m)?.[1]?.trim().toLowerCase());
    expect(terms.every(Boolean)).toBe(true);
    expect(new Set(terms).size).toBe(terms.length);
    for (const week of [5, 6]) {
      for (let day = 1; day <= 7; day += 1) {
        const prefix = `vocabulary.w${String(week).padStart(2, "0")}.d${String(day).padStart(2, "0")}.`;
        expect(localContentPayloads.filter(item => item.id.startsWith(prefix)), prefix).toHaveLength(7);
      }
    }
  });

  it("يحتوي كل درس قواعد على 20 سؤالًا بثلاثة خيارات مميزة وإجابة معرفة", () => {
    const grammarItems = localContentPayloads.filter(item => item.skill === "grammar");
    for (const item of grammarItems) {
      const questions = Array.from(item.contentMarkdown.matchAll(/\d+[.)]\s*(.+?)\nA\)\s*(.+?)\nB\)\s*(.+?)\nC\)\s*(.+?)\nAnswer:\s*([ABC])/g));
      expect(questions, item.id).toHaveLength(20);
      for (const [, , a, b, c, answer] of questions) {
        expect(new Set([a.trim(), b.trim(), c.trim()]).size, `${item.id} has duplicate choices`).toBe(3);
        expect("ABC").toContain(answer);
      }
    }
  });

  it("يربط كل نشاط استماع بمصدر حلقة محدد بدل صفحة فهرس عامة", () => {
    const listeningItems = localContentPayloads.filter(item => item.skill === "listening");
    for (const item of listeningItems) {
      const [url] = item.sourceUrls;
      expect(url, item.id).toMatch(/^https:\/\//);
      expect(url, item.id).not.toBe("https://www.bbc.co.uk/learningenglish/english/features/6-minute-english");
      expect(item.contentMarkdown).toContain(`URL: ${url}`);
    }
  });

  it("يحفظ بطاقات المفردات من الأسبوع الثالث فصاعدًا بالحقول الأساسية وخمسة أمثلة مترجمة", () => {
    const vocabularyItems = localContentPayloads.filter(item => item.skill === "vocabulary" && item.week >= 3);
    expect(vocabularyItems).toHaveLength(14 + 98);
    for (const item of vocabularyItems) {
      expect(item.contentMarkdown, item.id).toMatch(/Term:\s*\S+/);
      expect(item.contentMarkdown, item.id).toMatch(/IPA:\s*\/[^/]+\//);
      expect(item.contentMarkdown, item.id).toMatch(/Arabic meaning:\s*[\u0600-\u06FF]/);
      expect(item.contentMarkdown, item.id).toMatch(/Part of speech:\s*\S+/);
      expect(item.contentMarkdown, item.id).toMatch(/Mechatronics domain:\s*\S+/);
      const examples = Array.from(item.contentMarkdown.matchAll(/\n[1-5][.)]\s*.+\n\s*([^\n]+)/g));
      expect(examples, item.id).toHaveLength(5);
      expect(examples.every(([, translation]) => /[\u0600-\u06FF]/.test(translation)), item.id).toBe(true);
    }
  });

  it("يحتوي كل درس قواعد على مهمة كتابة قصيرة قابلة للاستخراج للواجهة", () => {
    const grammarItems = localContentPayloads.filter(item => item.skill === "grammar");
    for (const item of grammarItems) {
      const writingSection = item.contentMarkdown.match(/(?:سؤالان للكتابة الهندسية(?: \(قصيرة\))?|مهمتان قصيرتان للكتابة الهندسية|(?:مهام?|مهمات) كتابة قصيرة|كتابة قصيرة(?: \([^)]*\))?)\s*:?\s*\n([\s\S]*?)(?:\n\n(?:مراجع|ملاحظة|تلميح|تذكير)|$)/)?.[1] ?? "";
      const prompts = Array.from(writingSection.matchAll(/(?:^|\n)\d+[.)]\s*(.+)/g));
      expect(prompts.length, item.id).toBeGreaterThan(0);
    }
  });

  it("يحتوي استماع الأسبوعين الخامس والسادس على ستة أسئلة ومفتاح إجابات بالعدد نفسه ومصدر مختلف لكل يوم", () => {
    const items = localContentPayloads.filter(item => item.skill === "listening" && item.week >= 5);
    expect(items).toHaveLength(14);
    expect(new Set(items.map(item => item.sourceUrls[0])).size).toBe(14);
    for (const item of items) {
      const questions = Array.from(item.contentMarkdown.matchAll(/(?:^|\n)\d+\)\s*(.+?)\s*\(([^)\n]+)\)(?=\n|$)/g));
      expect(questions, item.id).toHaveLength(6);
      const answers = Array.from(item.contentMarkdown.matchAll(/^- Q(\d):\s*(.+)$/gm));
      expect(answers.map(([, number]) => Number(number)), item.id).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it("يستخدم كل درس قواعد في الأسبوعين الخامس والسادس روابط Cambridge وتتوزع الإجابات الصحيحة على A وB وC", () => {
    const items = localContentPayloads.filter(item => item.skill === "grammar" && item.week >= 5);
    for (const item of items) {
      expect(item.sourceUrls.length, item.id).toBeGreaterThan(0);
      expect(item.sourceUrls.every(url => url.startsWith("https://dictionary.cambridge.org/grammar/british-grammar/")), item.id).toBe(true);
      const letters = Array.from(item.contentMarkdown.matchAll(/Answer:\s*([ABC])/g)).map(([, letter]) => letter);
      for (const letter of ["A", "B", "C"]) expect(letters.filter(value => value === letter).length, `${item.id} ${letter}`).toBeGreaterThanOrEqual(5);
    }
  });
});
