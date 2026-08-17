import { readFile, writeFile } from "node:fs/promises";

const sources = [
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english/ep-211007",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english_2025/ep-250918",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english_2022/ep-220609",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english/ep-210916",
  "https://www.bbc.co.uk/learningenglish/features/6-minute-english/ep-150611",
  "https://www.youtube.com/watch?v=NVgpf-SFs0g",
  "https://www.youtube.com/watch?v=rnBQXmO_StE",
];

for (const week of ["week-01", "week-02"]) {
  const path = `/home/ubuntu/adaptive-english-coach/server/content-library/weeks/${week}/listening.json`;
  const pack = JSON.parse(await readFile(path, "utf8"));
  pack.items.forEach((item, index) => {
    const url = sources[index];
    item.sourceUrls = [url];
    item.contentMarkdown = item.contentMarkdown
      .replace(/^URL:\s*https?:\/\/\S+/m, `URL: ${url}`)
      .replace(/^Source:\s*.+$/m, "Source: BBC Learning English — 6 Minute English (selected episode)");
  });
  await writeFile(path, `${JSON.stringify(pack, null, 2)}\n`);
}
