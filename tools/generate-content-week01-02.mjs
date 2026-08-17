import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.OPENAI_API_BASE;
const apiKey = process.env.OPENAI_API_KEY;
if (!base || !apiKey) throw new Error("Missing sandbox LLM credentials");

const root = "/home/ubuntu/adaptive-english-coach/server/content-library/weeks";
const skills = ["vocabulary", "grammar", "conversation", "listening", "writing"];
const weeks = [
  { week: 1, theme: "Introducing mechatronics and core components", themeArabic: "تعريف الميكاترونيك والمكونات الأساسية", focus: "professional self-introduction, system components, simple functions, present simple" },
  { week: 2, theme: "Sensors and measurement", themeArabic: "الحساسات والقياس", focus: "describing sensors, measurement, accuracy, present continuous in technical testing" },
];

const schema = {
  type: "object",
  properties: {
    week: { type: "integer" },
    skill: { type: "string" },
    items: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          titleArabic: { type: "string" },
          titleEnglish: { type: "string" },
          promptTemplateId: { type: "string" },
          sourceUrls: { type: "array", items: { type: "string" } },
          contentMarkdown: { type: "string" },
        },
        required: ["id", "titleArabic", "titleEnglish", "promptTemplateId", "sourceUrls", "contentMarkdown"],
        additionalProperties: false,
      },
    },
  },
  required: ["week", "skill", "items"],
  additionalProperties: false,
};

function instructions(week, skill) {
  const shared = `You are authoring an offline, original English-learning library for a recent Mechatronics Engineering graduate at A2/B1. Generate exactly seven daily items for week ${week.week}, theme: ${week.theme}. Arabic UI language; English learning content. Every id must be exactly ${skill}.w${String(week.week).padStart(2, "0")}.d01 through d07. Never reuse an item. Write accurate, simple original content. Do not copy copyrighted transcripts. Return the requested JSON schema only.`;
  const category = {
    vocabulary: "Each item is one vocabulary card. contentMarkdown must include: term, IPA, Arabic meaning, part of speech, mechatronics domain, and exactly five short English example sentences with accurate Arabic translation under each. Choose useful terms without repeating any term across seven items.",
    grammar: "Each item is a complete Arabic grammar lesson. contentMarkdown must include: Arabic explanation, form, 2 mechatronics examples with Arabic translation, common Arabic-speaker mistake, 20 distinct three-option multiple-choice questions with answers labeled, and 2 short engineering writing prompts. Week 1 focuses on present simple and be/have; week 2 on present continuous and testing actions. Add relevant British Council grammar URLs.",
    conversation: "Each item is an AI conversation prompt. contentMarkdown must include Arabic topic description, five target English words with Arabic translations, prompts for 5/10/13-minute modes, instructions to ask one question at a time, and a precise final rubric out of 10 for fluency, vocabulary, grammar, clarity, then three corrections. Cover interviews, daily engineering work, and general professional communication over the seven days.",
    listening: "Each item is a listening activity. Use only a public British Council or BBC Learning English URL. contentMarkdown must include source and URL, a 1/2/4-minute listening focus, six original comprehension/reflection questions graduated so modes can use first 2, first 4, or all 6, a phrase-capture instruction, and no transcript. Ensure the item title accurately fits the public source category, not a fabricated episode title.",
    writing: "Each item is a professional engineering writing task. contentMarkdown must include Arabic brief, target length for 1/3/5 sentence modes, target vocabulary, a model answer in English with Arabic translation, and self-check rubric. Cover introductions, component descriptions, test notes, measurement observations, and concise emails.",
  }[skill];
  return `${shared}\n\n${category}`;
}

async function generate(week, skill) {
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are a precise curriculum writer. Follow identifiers and output schema exactly." },
        { role: "user", content: instructions(week, skill) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "offline_content_pack", strict: true, schema } },
      max_completion_tokens: 18000,
    }),
  });
  if (!response.ok) throw new Error(`${skill} week ${week.week}: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content;
  const generated = JSON.parse(text);
  const data = { ...generated, week: week.week, skill };
  if (data.items?.length !== 7) {
    await fs.writeFile(`/home/ubuntu/adaptive-english-coach/tools/content-generation-debug-${skill}-w${week.week}.json`, JSON.stringify({ payload, data }, null, 2));
    throw new Error(`Invalid generated pack for ${skill} week ${week.week}`);
  }
  for (const [index, item] of data.items.entries()) {
    const expected = `${skill}.w${String(week.week).padStart(2, "0")}.d${String(index + 1).padStart(2, "0")}`;
    if (item.id !== expected || !item.contentMarkdown?.trim()) throw new Error(`Invalid item ${expected}`);
  }
  const directory = path.join(root, `week-${String(week.week).padStart(2, "0")}`);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${skill}.json`), JSON.stringify(data, null, 2) + "\n");
  return `${skill} w${week.week}`;
}

const requestedWeek = Number(process.env.CONTENT_WEEK ?? 0);
const requestedSkill = process.env.CONTENT_SKILL;
const jobs = weeks
  .filter(week => !requestedWeek || week.week === requestedWeek)
  .flatMap(week => skills.filter(skill => !requestedSkill || skill === requestedSkill).map(skill => ({ week, skill })));
const results = [];
for (let index = 0; index < jobs.length; index += 3) {
  const batch = await Promise.all(jobs.slice(index, index + 3).map(job => generate(job.week, job.skill)));
  results.push(...batch);
}
console.log(`Generated: ${results.join(", ")}`);
