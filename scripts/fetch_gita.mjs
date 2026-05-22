// One-time corpus fetch. Source: github.com/gita/gita (Unlicense / public domain).
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/gita/gita/main/data";
const FILES = ["verse.json", "translation.json", "authors.json", "chapters.json"];

await mkdir("scripts/.raw", { recursive: true });

for (const f of FILES) {
  const res = await fetch(`${BASE}/${f}`);
  if (!res.ok) throw new Error(`${f}: ${res.status}`);
  const text = await res.text();
  await writeFile(`scripts/.raw/${f}`, text);
  const data = JSON.parse(text);
  const sample = Array.isArray(data) ? data[0] : data;
  console.log(`\n=== ${f} (${(text.length / 1024).toFixed(0)} KB, ${Array.isArray(data) ? data.length + " items" : "object"}) ===`);
  console.log(JSON.stringify(sample, null, 2).slice(0, 900));
}
