import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.OPENAI_API_BASE;
const apiKey = process.env.OPENAI_API_KEY;
if (!base || !apiKey) throw new Error("Missing sandbox LLM credentials");

const root = "/home/ubuntu/adaptive-english-coach/server/content-library/weeks";
const skills = ["vocabulary", "grammar", "conversation", "listening", "writing"];
const weeks = [
  { week: 3, theme: "Actuators and closed-loop control", themeArabic: "المشغلات وحلقة التحكم المغلقة", focus: "motors, relays, solenoids, valve position, set point, process value, feedback, safe control instructions", grammarFocus: "modals for safe instructions and zero/first conditional in technical situations" },
  { week: 4, theme: "Testing, fault finding and concise technical reporting", themeArabic: "الاختبار واستكشاف الأعطال والتقرير التقني المختصر", focus: "symptoms, power checks, wiring continuity, error codes, isolation, root cause, corrective action, test logs", grammarFocus: "past simple for test records, sequence markers, cause and effect, and practical conditionals" },
];

const listeningSources = [
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english/ep-211007",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english_2025/ep-250918",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english_2022/ep-220609",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english/ep-210916",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english/ep-150611",
  "https://www.youtube.com/watch?v=NVgpf-SFs0g",
  "https://www.youtube.com/watch?v=rnBQXmO_StE",
];

const schema = {
  type: "object",
  properties: {
    week: { type: "integer" }, skill: { type: "string" },
    items: { type: "array", minItems: 7, maxItems: 7, items: { type: "object", properties: {
      id: { type: "string" }, titleArabic: { type: "string" }, titleEnglish: { type: "string" }, promptTemplateId: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } }, contentMarkdown: { type: "string" },
    }, required: ["id", "titleArabic", "titleEnglish", "promptTemplateId", "sourceUrls", "contentMarkdown"], additionalProperties: false } },
  },
  required: ["week", "skill", "items"], additionalProperties: false,
};

function instructions(week, skill) {
  const prefix = `You author original offline English-learning content for a recent Mechatronics Engineering graduate at A2/B1. The interface explanation language is Arabic; all target English is simple, accurate American/British international English. Generate exactly seven distinct daily items for week ${week.week}: ${week.theme}. Focus: ${week.focus}. Grammar focus: ${week.grammarFocus}. IDs must be ${skill}.w${String(week.week).padStart(2, "0")}.d01 through d07 in that order. Do not repeat the core topics or terms used in weeks 1–2 (sensor, actuator, microcontroller, PCB, motor, servo, feedback loop, ultrasonic sensor) as the main target item. Never copy copyrighted transcripts. Return only schema-valid JSON.`;
  const details = {
    vocabulary: "Each item is one useful engineering vocabulary card. contentMarkdown must state the term, IPA, Arabic meaning, part of speech, mechatronics domain, and exactly five short English example sentences each followed by an accurate Arabic translation. Select seven different practical terms across the week.",
    grammar: "Each item is a complete Arabic grammar lesson. contentMarkdown must contain an Arabic explanation, form, exactly two mechatronics examples with Arabic translations, one common Arabic-speaker mistake, exactly 20 distinct three-option multiple-choice questions numbered 1) through 20) in the exact A/B/C plus Answer: format, and exactly two short engineering writing prompts. Every answer must be grammatical and unambiguous; no duplicate choices within a question. Add only relevant British Council grammar URLs.",
    conversation: "Each item is an AI conversation prompt. contentMarkdown must contain an Arabic topic description, exactly five target English words with Arabic translations, prompts for 5/10/13-minute modes, instruction to ask one question at a time, and a final 10-point rubric for fluency, vocabulary, grammar, and clarity, followed by three corrective examples. Spread work interviews, daily engineering work, and professional general communication across the days.",
    listening: `Each item is a listening activity. It must use the matching exact public source URL for its day in this ordered list: ${listeningSources.join(", ")}. contentMarkdown must start with Source and URL, name the source honestly as a selected BBC Learning English or official BBC Learning English YouTube episode without inventing an episode title, include a 1/2/4-minute focus, six original graduated reflection/comprehension prompts (first 2 for steady, first 4 for balanced, all 6 for intensive), and phrase-capture instruction. Do not include a transcript or claims about details that may not occur in the source.`,
    writing: "Each item is a professional engineering writing task. contentMarkdown must contain Arabic brief, target lengths for 1/3/5 sentence modes, target vocabulary, a concise accurate English model answer with Arabic translation, and a self-check rubric. Cover safe operating instructions, control-loop observation, test notes, fault reports, handover notes, and concise professional emails.",
  }[skill];
  return `${prefix}\n\n${details}`;
}

function validate(data, week, skill) {
  if (data.items?.length !== 7) throw new Error(`Invalid count for ${skill} week ${week.week}`);
  for (const [index, item] of data.items.entries()) {
    const expected = `${skill}.w${String(week.week).padStart(2, "0")}.d${String(index + 1).padStart(2, "0")}`;
    if (item.id !== expected || !item.contentMarkdown?.trim()) throw new Error(`Invalid item ${expected}`);
    if (skill === "grammar") {
      const questions = Array.from(item.contentMarkdown.matchAll(/\d+[.)]\s*(.+?)\nA\)\s*(.+?)\nB\)\s*(.+?)\nC\)\s*(.+?)\nAnswer:\s*([ABC])/g));
      if (questions.length !== 20) throw new Error(`Invalid question count for ${expected}`);
      if (questions.some(([, , a, b, c]) => new Set([a.trim(), b.trim(), c.trim()]).size !== 3)) throw new Error(`Duplicate grammar choices in ${expected}`);
    }
    if (skill === "listening" && item.sourceUrls?.[0] !== listeningSources[index]) throw new Error(`Invalid listening source for ${expected}`);
  }
}

function normalizeGrammarQuestions(markdown) {
  if (!markdown.includes("Answer:") || !/\d+[.)]\s*A\)/.test(markdown)) return markdown;
  return markdown
    .replace(/(\d+[.)])\s*A\)\s*/g, "$1 Choose the correct option.\nA) ")
    .replace(/\s{2,}B\)\s*/g, "\nB) ")
    .replace(/\s{2,}C\)\s*/g, "\nC) ")
    .replace(/\s{2,}Answer:\s*/g, "\nAnswer: ");
}

async function generate(week, skill) {
  const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are a precise curriculum writer. Follow all identifiers, exact formats, and source constraints." }, { role: "user", content: instructions(week, skill) }], response_format: { type: "json_schema", json_schema: { name: "offline_content_pack", strict: true, schema } }, max_completion_tokens: 18000 }) });
  if (!response.ok) throw new Error(`${skill} week ${week.week}: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const generated = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  const data = { ...generated, week: week.week, skill };
  if (skill === "grammar") data.items = data.items.map(item => ({ ...item, contentMarkdown: normalizeGrammarQuestions(item.contentMarkdown) }));
  try { validate(data, week, skill); } catch (error) { await fs.writeFile(`/home/ubuntu/adaptive-english-coach/tools/content-generation-debug-${skill}-w${week.week}.json`, JSON.stringify({ payload, data, error: String(error) }, null, 2)); throw error; }
  const directory = path.join(root, `week-${String(week.week).padStart(2, "0")}`);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${skill}.json`), `${JSON.stringify(data, null, 2)}\n`);
  return `${skill} w${week.week}`;
}

const requestedWeek = Number(process.env.CONTENT_WEEK ?? 0);
const requestedSkill = process.env.CONTENT_SKILL;
const jobs = weeks.filter(week => !requestedWeek || week.week === requestedWeek).flatMap(week => skills.filter(skill => !requestedSkill || skill === requestedSkill).map(skill => ({ week, skill })));
const results = [];
for (let index = 0; index < jobs.length; index += 2) results.push(...await Promise.all(jobs.slice(index, index + 2).map(job => generate(job.week, job.skill))));
console.log(`Generated: ${results.join(", ")}`);
