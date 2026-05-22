/**
 * Build the verified Bhagavad Gita corpus consumed by the RAG retriever.
 *
 * Source: github.com/gita/gita (Unlicense — public domain).
 * Sanskrit + transliteration: data/verse.json
 * English translation: Swami Sivananda (data/translation.json, lang=english)
 *
 * Output: lib/data/gita.json — one record per verse, plus lightweight
 * theme tags derived from a fixed lexicon (used to boost retrieval; the
 * answer text itself always comes from the verified translation field).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const RAW = "scripts/.raw";
const ENGLISH_AUTHOR = "Swami Sivananda";

const verses = JSON.parse(await readFile(`${RAW}/verse.json`, "utf8"));
const translations = JSON.parse(await readFile(`${RAW}/translation.json`, "utf8"));

const englishByVerseId = new Map();
for (const t of translations) {
  if (t.lang === "english" && t.authorName === ENGLISH_AUTHOR) {
    englishByVerseId.set(t.verse_id, t);
  }
}

// Theme lexicon — maps a life-situation theme to trigger words. A verse is
// tagged with a theme when its translation contains any of the words. These
// tags only bias retrieval; they are never shown as scripture.
const THEMES = {
  anxiety: ["fear", "anxious", "anxiety", "worry", "grieve", "grief", "sorrow", "despondency", "agitated", "restless"],
  duty: ["duty", "action", "work", "karma", "ordained", "prescribed", "obligatory", "perform"],
  detachment: ["attachment", "fruit", "result", "renounce", "renunciation", "desireless", "unattached", "indifferent"],
  grief: ["grief", "sorrow", "weep", "lament", "mourn", "death", "dead", "slain", "perish"],
  anger: ["anger", "wrath", "lust", "greed", "delusion", "passion"],
  peace: ["peace", "tranquil", "serene", "calm", "equanimity", "steady", "balanced", "contentment"],
  meditation: ["meditation", "meditate", "yoga", "concentrate", "mind", "self-controlled", "abstraction"],
  devotion: ["devotion", "devotee", "worship", "surrender", "faith", "refuge", "love"],
  knowledge: ["knowledge", "wisdom", "ignorance", "truth", "self", "soul", "eternal", "imperishable"],
  purpose: ["purpose", "path", "liberation", "salvation", "perfection", "highest", "supreme"],
  ego: ["ego", "egoism", "pride", "i-ness", "mine-ness", "vanity"],
  fear: ["fear", "afraid", "terror", "danger", "fearless"],
};

function cleanSanskrit(text) {
  return text
    .replace(/।।[\d.०-९]+।।/g, "") // strip "।।1.1।।" verse markers
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const corpus = [];
let missing = 0;

for (const v of verses) {
  const en = englishByVerseId.get(v.id);
  if (!en || !en.description) {
    missing++;
    continue;
  }
  const translation = en.description.replace(/\s+/g, " ").trim();
  const haystack = `${translation} ${(v.word_meanings || "").toLowerCase()}`.toLowerCase();
  const themes = Object.entries(THEMES)
    .filter(([, words]) => words.some((w) => haystack.includes(w)))
    .map(([name]) => name);

  corpus.push({
    id: v.id,
    chapter: v.chapter_number,
    verse: v.verse_number,
    ref: `Bhagavad Gita ${v.chapter_number}.${v.verse_number}`,
    sanskrit: cleanSanskrit(v.text || ""),
    transliteration: (v.transliteration || "").trim(),
    translation,
    themes,
  });
}

corpus.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);

await mkdir("lib/data", { recursive: true });
await writeFile(
  "lib/data/gita.json",
  JSON.stringify(
    {
      meta: {
        source: "github.com/gita/gita",
        license: "Unlicense (public domain)",
        translation: `${ENGLISH_AUTHOR} (English)`,
        verseCount: corpus.length,
        builtAt: new Date().toISOString().slice(0, 10),
      },
      verses: corpus,
    },
    null,
    0
  )
);

console.log(`Wrote lib/data/gita.json — ${corpus.length} verses, ${missing} missing English.`);
console.log("Sample 2.47:", JSON.stringify(corpus.find((c) => c.ref === "Bhagavad Gita 2.47"), null, 2));
