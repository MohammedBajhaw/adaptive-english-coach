import { describe, expect, it } from "vitest";
import { localContentPayloads } from "./content-library/library";

describe("حزمة المحتوى المحلي للأسبوعين الأولين", () => {
  it("تتضمن سبعة عناصر يومية لكل مهارة في كل أسبوع مع معرفات فريدة", () => {
    expect(localContentPayloads).toHaveLength(70);
    const ids = localContentPayloads.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const week of [1, 2]) {
      for (const skill of ["vocabulary", "grammar", "listening", "speaking", "writing"]) {
        const items = localContentPayloads.filter(item => item.week === week && item.skill === skill);
        expect(items).toHaveLength(7);
        expect(items.map(item => item.id)).toEqual(expect.arrayContaining(Array.from({ length: 7 }, (_, index) => `${skill === "speaking" ? "conversation" : skill}.w${String(week).padStart(2, "0")}.d${String(index + 1).padStart(2, "0")}`)));
      }
    }
  });

  it("يحتوي كل درس قواعد على 20 سؤالًا بثلاثة خيارات مميزة وإجابة معرفة", () => {
    const grammarItems = localContentPayloads.filter(item => item.skill === "grammar");
    for (const item of grammarItems) {
      const questions = Array.from(item.contentMarkdown.matchAll(/\d+\)\s*(.+?)\nA\)\s*(.+?)\nB\)\s*(.+?)\nC\)\s*(.+?)\nAnswer:\s*([ABC])/g));
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
});
