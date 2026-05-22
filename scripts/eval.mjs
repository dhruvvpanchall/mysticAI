/**
 * Phase 1 milestone check (doc §05/§09): 50 hand-crafted questions across
 * anxiety, duty, grief, anger, relationships, etc. Verifies the retriever
 * surfaces sensible, real verses — the doc's headline test is
 * "I'm stressed about work" → Gita 2.47 / 6.5.
 *
 * This mirrors the BM25 in lib/gita.ts (kept small and dependency-free so it
 * runs with plain `node` outside Next). If you change retrieval, update both.
 */
import { readFile } from "node:fs/promises";

const { verses } = JSON.parse(await readFile("lib/data/gita.json", "utf8"));

// Kept in sync with lib/gita.ts STOPWORDS — see comment there.
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
  anxiety: ["anxious", "anxiety", "worry", "worried", "stress", "stressed", "overwhelmed", "restless", "agitated", "racing", "panic"],
  duty: ["duty", "work", "job", "career", "action", "responsibility", "obligation", "perform"],
  detachment: ["attachment", "attached", "result", "results", "outcome", "expectation", "letting", "renounce", "detach"],
  grief: ["grief", "grieving", "loss", "lost", "death", "died", "mourning", "sorrow", "sad", "bereaved"],
  anger: ["anger", "angry", "rage", "frustrated", "resentment", "hatred", "temper", "lust", "greed"],
  peace: ["peace", "calm", "still", "stillness", "serenity", "tranquil", "equanimity", "balance", "centered", "contentment"],
  meditation: ["meditation", "meditate", "mind", "focus", "concentration", "distracted", "overthinking", "thoughts", "stillness", "racing"],
  devotion: ["devotion", "faith", "surrender", "trust", "worship", "love", "god"],
  knowledge: ["knowledge", "wisdom", "truth", "soul", "self", "meaning", "ignorance"],
  purpose: ["purpose", "path", "meaning", "liberation", "direction", "calling"],
  ego: ["ego", "pride", "arrogance", "vanity", "selfish"],
  fear: ["fear", "afraid", "scared", "fearful", "terror"],
};
const detectThemes = (qSet) => {
  const hit = new Set();
  for (const [theme, words] of Object.entries(THEME_LEXICON))
    if (words.some((w) => qSet.has(w))) hit.add(theme);
  return hit;
};

const K1 = 1.5,
  B = 0.75;
const docs = verses.map((v) => tok(v.translation));
const dl = docs.map((d) => d.length);
const avgdl = dl.reduce((s, n) => s + n, 0) / dl.length;
const df = new Map();
for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
const N = verses.length;
const idf = new Map(
  [...df].map(([t, n]) => [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))])
);
const tf = docs.map((d) => {
  const m = new Map();
  for (const t of d) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
});

function retrieve(q, k = 3) {
  const qs = new Set(tok(q));
  const qThemes = detectThemes(qs);
  return verses
    .map((v, i) => {
      let s = 0;
      for (const t of qs) {
        const f = tf[i].get(t);
        if (f)
          s +=
            (idf.get(t) ?? 0) *
            ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (dl[i] / avgdl))));
      }
      for (const th of v.themes) {
        if (qThemes.has(th)) s += 2.2;
        if (qs.has(th)) s += 1.4;
      }
      return { ref: v.ref, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
}

const QUESTIONS = [
  "I'm overwhelmed and stressed about work",
  "I keep worrying about whether my effort will pay off",
  "How do I deal with anger I can't control",
  "I lost someone I love, how do I carry this grief",
  "My mind never stops racing, how do I find stillness",
  "I'm afraid of failing",
  "Should I act even when I don't feel like it",
  "How do I let go of the results of my actions",
  "I feel attached to outcomes I cannot control",
  "What does the Gita say about doing one's duty",
  "I am consumed by desire and craving",
  "How do I find inner peace",
  "I feel depressed and without purpose",
  "What is the nature of the soul",
  "Is the soul immortal",
  "How should I treat success and failure",
  "I'm jealous of other people's lives",
  "How do I practice meditation",
  "What is true knowledge",
  "How do I surrender to God",
  "I feel proud and full of ego",
  "How do I act without selfish motive",
  "What happens after death",
  "I'm anxious about the future",
  "How do I control my restless mind",
  "What is devotion",
  "How do I stay calm in difficulty",
  "I feel torn about a hard decision",
  "What is the path to liberation",
  "How do I overcome fear",
  "Why should I do my work without attachment",
  "I'm grieving the death of a relative",
  "How do I treat friends and enemies alike",
  "What is equanimity",
  "How do I conquer lust and greed",
  "I feel my life has no meaning",
  "What is selfless action",
  "How do I quiet my senses",
  "What does Krishna say about faith",
  "How do I deal with sorrow",
  "I want to renounce everything, is that right",
  "What is the steady wisdom of a sage",
  "How do I focus my mind in meditation",
  "I am paralyzed by doubt",
  "What is the highest goal of life",
  "How do I remain unshaken by pleasure and pain",
  "I feel discouraged and want to give up",
  "What is the duty of a person in society",
  "How do I find God within myself",
  "How should I face my responsibilities",
];

let withResults = 0;
for (const q of QUESTIONS) {
  const top = retrieve(q, 3);
  if (top[0].s > 0) withResults++;
  console.log(
    `• ${q}\n   → ${top.map((t) => `${t.ref} (${t.s.toFixed(1)})`).join(", ")}`
  );
}
console.log(
  `\n${withResults}/${QUESTIONS.length} questions retrieved a scored verse.`
);
