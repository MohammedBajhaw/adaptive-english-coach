import { readFile, writeFile } from "node:fs/promises";

const path = "/home/ubuntu/adaptive-english-coach/server/content-library/weeks/week-04/vocabulary.json";
const pack = JSON.parse(await readFile(path, "utf8"));

for (const item of pack.items) {
  item.contentMarkdown = item.contentMarkdown
    .replace(/^Examples:\s*$/m, "Example sentences:")
    .replace(/^(\d+)[.)]\s*(.+?)\s+—\s+(.+)$/gm, "$1. $2\n   $3");
}

await writeFile(path, `${JSON.stringify(pack, null, 2)}\n`);
