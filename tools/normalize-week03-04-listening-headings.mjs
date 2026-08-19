import { readFile, writeFile } from "node:fs/promises";

for (const week of ["week-03", "week-04"]) {
  const path = `/home/ubuntu/adaptive-english-coach/server/content-library/weeks/${week}/listening.json`;
  const pack = JSON.parse(await readFile(path, "utf8"));
  for (const item of pack.items) {
    const [url] = item.sourceUrls;
    const header = `Source: BBC Learning English — selected episode\nURL: ${url}\n\n`;
    item.contentMarkdown = `${header}${item.contentMarkdown.replace(/^(?:Source(?: and URL)?|Source)\s*:\s*[\s\S]*?(?:\n\n|$)/, "")}`;
  }
  await writeFile(path, `${JSON.stringify(pack, null, 2)}\n`);
}
