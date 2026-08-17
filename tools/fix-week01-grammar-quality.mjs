import { readFile, writeFile } from "node:fs/promises";

const path = "/home/ubuntu/adaptive-english-coach/server/content-library/weeks/week-01/grammar.json";
const pack = JSON.parse(await readFile(path, "utf8"));
const review = pack.items.find(item => item.id === "grammar.w01.d07");

if (!review) throw new Error("Missing grammar.w01.d07");

review.contentMarkdown = review.contentMarkdown
  .replace("5) The device ___ not power up.\nA) do\nB) does\nC) is\nAnswer: C", "5) The device ___ not power up.\nA) do\nB) does\nC) is\nAnswer: B")
  .replace("12) The fan ___ not run during standby.\nA) do\nB) does\nC) is\nAnswer: C", "12) The fan ___ not run during standby.\nA) do\nB) does\nC) is\nAnswer: B")
  .replace("15) He ___ calibrates the sensor monthly.\nA) always\nB) always\nC) always\nAnswer: A", "15) He ___ the sensor monthly.\nA) always calibrate\nB) always calibrates\nC) calibrate always\nAnswer: B");

await writeFile(path, `${JSON.stringify(pack, null, 2)}\n`);
