/**
 * Ad-hoc retrieval probe for the audit — reuses the BM25 from eval.mjs but on
 * the exact natural-language queries we hit the chat API with. Lets us see
 * what verses the route was grounding on, without burning LLM quota.
 */
import { readFile } from "node:fs/promises";

const { verses } = JSON.parse(await readFile("lib/data/gita.json", "utf8"));

const STOP = new Set(
  (
    "the a an is are am i im to of and or but in on at it my me for with about " +
    "how do should can what why when feel feeling felt really very so this that " +
    "have has had be been being you your yours we us our ours they them their " +
    "theirs he she his her hers not no does did from as if then than too over " +
    "under again more most cant cannot couldnt wouldnt shouldnt dont don " +
    "could would shouldve couldve wouldve " +
    "know knew known want wanted wants make made making get gets getting got " +
    "give gives given giving find finds found finding take takes taking took " +
    "keep keeps keeping kept let lets letting like likes liked just only even " +
    "also thing things something anything everything someone " +
    "anyone everyone lot lots much many bit nothing maybe perhaps actually " +
    "able unable always never sometimes often usually quite pretty kinda sorta " +
    "way ways gonna wanna gotta need needs needed needing"
  ).split(/\s+/)
);
const tok = (s) =>
  s.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 2 && !STOP.has(t));

const THEME_LEXICON = {
  anxiety: ["anxious", "anxiety", "worry", "worried", "stress", "stressed", "overwhelmed", "restless", "agitated", "racing", "panic", "future", "sleep", "sleepless", "insomnia", "tension", "nervous"],
  duty: ["duty", "work", "job", "career", "action", "responsibility", "obligation", "perform"],
  detachment: ["attachment", "attached", "result", "results", "outcome", "expectation", "letting", "renounce", "detach"],
  grief: ["grief", "grieving", "loss", "lost", "death", "died", "mourning", "sorrow", "sad", "bereaved", "heartbroken", "heartbreak", "breakup"],
  anger: ["anger", "angry", "rage", "frustrated", "resentment", "hatred", "temper", "lust", "greed", "furious", "betrayed"],
  peace: ["peace", "calm", "still", "stillness", "serenity", "tranquil", "equanimity", "balance", "centered", "contentment"],
  meditation: ["meditation", "meditate", "mind", "focus", "concentration", "distracted", "overthinking", "thoughts", "stillness", "racing"],
  devotion: ["devotion", "faith", "surrender", "trust", "worship", "love", "god"],
  knowledge: ["knowledge", "wisdom", "truth", "soul", "self", "meaning", "ignorance"],
  purpose: ["purpose", "path", "meaning", "liberation", "direction", "calling"],
  ego: ["ego", "pride", "arrogance", "vanity", "selfish"],
  fear: ["fear", "afraid", "scared", "fearful", "terror", "terrified"],
};

const THEME_ANCHORS = {
  anxiety:    ["2.66", "6.34", "6.35"],
  grief:      ["2.11", "2.13", "2.27"],
  anger:      ["2.62", "2.63", "5.23"],
  detachment: ["2.47", "2.48"],
  peace:      ["2.66", "2.71", "6.27"],
  meditation: ["6.5", "6.26", "6.35"],
  devotion:   ["9.22", "18.66"],
  fear:       ["18.66", "2.40"],
  duty:       ["2.47", "3.8", "18.45"],
  purpose:    ["2.31", "18.47"],
  ego:        ["2.71", "16.18"],
  knowledge:  ["2.16", "4.38"],
};
const detectThemes = (qSet) => {
  const hit = new Set();
  for (const [theme, words] of Object.entries(THEME_LEXICON))
    if (words.some((w) => qSet.has(w))) hit.add(theme);
  return hit;
};

const K1 = 1.5, B = 0.75;
const docs = verses.map((v) => tok(v.translation));
const dl = docs.map((d) => d.length);
const avgdl = dl.reduce((s, n) => s + n, 0) / dl.length;
const df = new Map();
for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
const N = verses.length;
const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))]));
const tf = docs.map((d) => {
  const m = new Map();
  for (const t of d) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
});

function retrieve(q, k = 5) {
  const qs = new Set(tok(q));
  const qThemes = detectThemes(qs);
  const scored = verses.map((v, i) => {
    let s = 0;
    for (const t of qs) {
      const f = tf[i].get(t);
      if (f) s += (idf.get(t) ?? 0) * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (dl[i] / avgdl))));
    }
    for (const th of v.themes) {
      if (qThemes.has(th)) s += 5.0;
      if (qs.has(th)) s += 2.5;
    }
    return { ref: v.ref, s, themes: v.themes, snippet: v.translation.slice(0, 80) };
  });
  // Theme-anchor boost — mirrors lib/gita.ts THEME_ANCHORS.
  for (const theme of qThemes) {
    const anchors = THEME_ANCHORS[theme] || [];
    for (const ref of anchors) {
      const hit = scored.find(r => r.ref === `Bhagavad Gita ${ref}`);
      if (hit) hit.s += 12.0;
    }
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, k);
}

const PROBES = [
  "I feel anxious about my exams tomorrow and cannot sleep",
  "I am very angry with my brother and cannot let it go",
  "I lost my father",
  "I lost my father last month, how do I bear this grief",
  "I am grieving the loss of my mother",
  "I am torn about quitting my job for something more meaningful",
  "I feel jealous of my friend's success",
  "I cannot stop overthinking",
  "I cannot stop overthinking, my mind races at night",
];
for (const q of PROBES) {
  console.log(`\nQ: ${q}`);
  for (const r of retrieve(q, 5)) {
    console.log(`   ${r.ref}  s=${r.s.toFixed(2)}  themes=[${r.themes.join(",")}]  "${r.snippet}…"`);
  }
}
