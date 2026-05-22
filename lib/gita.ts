/**
 * Bhagavad Gita corpus + retrieval.
 *
 * The corpus (lib/data/gita.json) is verified, public-domain text — never
 * model-generated. Retrieval is a dependency-free BM25 over the English
 * translation, with a bonus when the query matches a verse's theme tags.
 * 701 short documents fit comfortably in memory; the index is built once
 * per server process.
 */
import corpusData from "./data/gita.json";

export interface Verse {
  id: number;
  chapter: number;
  verse: number;
  ref: string;
  sanskrit: string;
  transliteration: string;
  translation: string;
  themes: string[];
}

export const corpusMeta = corpusData.meta;
const verses = corpusData.verses as Verse[];

// Mirrors the theme lexicon in scripts/build_corpus.mjs. Used to map a free
// query onto themes so we can boost verses tagged with them (the stored
// verses only carry theme *names*, not the trigger words).
const THEME_LEXICON: Record<string, string[]> = {
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

function detectThemes(qSet: Set<string>): Set<string> {
  const hit = new Set<string>();
  for (const [theme, words] of Object.entries(THEME_LEXICON)) {
    if (words.some((w) => qSet.has(w))) hit.add(theme);
  }
  return hit;
}

/**
 * Theme anchor verses — when a query strongly suggests a theme, these
 * canonical verses get a large boost so they dominate retrieval. Without
 * this, BM25 picks verses by coincidental keyword match: "I want to die"
 * topped verse 2.20 ("the soul is not killed when the body is killed")
 * purely on the lexical word "die", which is a wrong and unsafe pairing.
 * Anchors are chosen for EMOTIONAL relevance to the seeker, not for
 * philosophical depth or proximity to the keyword.
 */
const THEME_ANCHORS: Record<string, string[]> = {
  anxiety:    ["2.66", "6.34", "6.35"],     // mind's restlessness, practice & detachment
  grief:      ["2.11", "2.13", "2.27"],     // grieve not / soul moves through bodies
  anger:      ["2.62", "2.63", "5.23"],     // attachment → anger → delusion / endure it
  detachment: ["2.47", "2.48"],              // right to action, not to fruit / equanimity
  peace:      ["2.66", "2.71", "6.27"],     // peace for the steady mind
  meditation: ["6.5", "6.26", "6.35"],      // lift yourself / return mind / practice
  devotion:   ["9.22", "18.66"],             // I provide for those devoted / surrender
  fear:       ["18.66", "2.40"],             // do not fear, surrender / no loss of effort
  duty:       ["2.47", "3.8", "18.45"],     // perform your work / own dharma
  purpose:    ["2.31", "18.47"],             // your own dharma is your path
  ego:        ["2.71", "16.18"],             // free of I and mine
  knowledge:  ["2.16", "4.38"],              // truth and untruth / no purifier like knowledge
};

function anchorIndex(ref: string): number {
  // Verses are indexed by (chapter, verse); convert "2.47" → array index.
  for (let i = 0; i < verses.length; i++) {
    if (`${verses[i].chapter}.${verses[i].verse}` === ref) return i;
  }
  return -1;
}

// Precompute anchor indices once at module load — saves a linear scan per
// query per anchor verse.
const THEME_ANCHOR_IDX: Record<string, number[]> = Object.fromEntries(
  Object.entries(THEME_ANCHORS).map(([theme, refs]) => [
    theme,
    refs.map(anchorIndex).filter((i) => i >= 0),
  ])
);

// STOPWORDS — words so common they should not drive BM25 scoring. Includes
// modal/auxiliary verbs ("cannot", "could", "would", "should"), common
// scaffold verbs ("feel/feeling", "know/knew", "want/wanted", "make", "get",
// "give", "find", "take", "keep", "let") and filler nouns/quantifiers
// ("thing/things", "something", "someone", "anything", "lot", "much", "very").
// **GOTCHA:** before this list was expanded, "cannot" leaked through as a
// content term and verse 2.23 ("Weapons cannot cut it, fire cannot burn it,
// water cannot wet it, wind cannot dry it…") topped BM25 for ANY query
// containing "cannot" — so "I cannot stop overthinking" retrieved the
// soul-immortality verse instead of a meditation/mind verse.
const STOPWORDS = new Set(
  (
    "the a an is are am i im to of and or but in on at it my me for with about " +
    "how do should can what why when feel feeling felt really very so this that " +
    "have has had be been being you your yours we us our ours they them their " +
    "theirs he she his her hers not no does did from as if then than too over " +
    "under again more most cant cannot couldnt wouldnt shouldnt dont don " +
    "could would shouldve couldve wouldve would'nt could'nt should'nt " +
    "know knew known want wanted wants make made making get gets getting got " +
    "give gives given giving find finds found finding take takes taking took " +
    "keep keeps keeping kept let lets letting like likes liked just only even " +
    "also still still'ish thing things something anything everything someone " +
    "anyone everyone lot lots much many bit nothing maybe perhaps actually " +
    "able unable always never sometimes often usually quite pretty kinda sorta " +
    "way ways gonna wanna gotta need needs needed needing"
  ).split(/\s+/)
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// ---- BM25 index (built once at module load) -------------------------------

const K1 = 1.5;
const B = 0.75;

const docTokens: string[][] = verses.map((v) => tokenize(v.translation));
const docLen = docTokens.map((t) => t.length);
const avgdl = docLen.reduce((s, n) => s + n, 0) / (docLen.length || 1);

const df = new Map<string, number>();
for (const toks of docTokens) {
  for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
}
const idf = new Map<string, number>();
const N = verses.length;
for (const [term, n] of df) {
  idf.set(term, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
}

const termFreqs: Map<string, number>[] = docTokens.map((toks) => {
  const m = new Map<string, number>();
  for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
});

export interface Retrieved extends Verse {
  score: number;
}

/**
 * Retrieve the top-k most relevant verses for a free-text query. Falls back
 * to a small set of steadiness verses if nothing scores — the caller always
 * gets verified text to ground its answer in.
 */
export function retrieveVerses(query: string, k = 5): Retrieved[] {
  const qTokens = tokenize(query);
  const qSet = new Set(qTokens);
  // Themes implied by the *intent* of the query (e.g. "mind racing" →
  // meditation, peace), not just literal word overlap with the verse.
  const queryThemes = detectThemes(qSet);

  const scored = verses.map((v, i) => {
    let score = 0;
    const tf = termFreqs[i];
    for (const term of qSet) {
      const f = tf.get(term);
      if (!f) continue;
      const termIdf = idf.get(term) ?? 0;
      score +=
        termIdf *
        ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (docLen[i] / avgdl))));
    }
    // Theme bonus: verse shares a theme the query is about. Bumped from
    // +2.2/+1.4 to +5.0/+2.5 so that a theme-matched verse beats a verse
    // that merely contains a coincidental keyword.
    for (const theme of v.themes) {
      if (queryThemes.has(theme)) score += 5.0;
      if (qSet.has(theme)) score += 2.5;
    }
    return { ...v, score };
  });

  // ANCHOR BOOST — for each query theme, force the canonical verses for that
  // theme to the top with a large flat boost. This is what ensures grief
  // queries get 2.11/2.13/2.27 (real grief verses), not whatever BM25
  // happens to grab from lexical overlap.
  for (const theme of queryThemes) {
    const anchorIdxs = THEME_ANCHOR_IDX[theme];
    if (!anchorIdxs) continue;
    for (const idx of anchorIdxs) {
      scored[idx].score += 12.0;
    }
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored[0]?.score === 0) {
    return verses
      .filter((v) =>
        ["2.47", "2.14", "2.48", "6.5"].includes(`${v.chapter}.${v.verse}`)
      )
      .map((v) => ({ ...v, score: 0 }));
  }

  return scored.slice(0, k);
}
