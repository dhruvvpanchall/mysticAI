import type { Lesson } from "@/lib/practice/types";

/**
 * Builds the full Hindi narration for a Daily Wisdom lesson — chapter
 * intro, Sanskrit shloka, Hindi translation, "what Krishna teaches",
 * modern-life application, closing chintan. Everything in Devanagari so
 * the Hindi voice never has to wrestle with English vocabulary.
 *
 * Pure function — easy to test, easy to iterate without touching the
 * player component or any TTS adapter.
 */
export function buildLessonNarration(lesson: Lesson): string {
  return [
    `आज की दैनिक शिक्षा। भगवद गीता, अध्याय ${lesson.chapter}, श्लोक ${lesson.verse}।`,
    `पहले श्लोक सुनिए।`,
    lesson.sanskrit,
    `अब इस श्लोक का हिंदी अर्थ।`,
    lesson.hindi,
    `यहाँ कृष्ण क्या सिखा रहे हैं।`,
    lesson.hindiExplanation,
    `और आधुनिक जीवन में इसका अर्थ।`,
    lesson.hindiModernLife,
    `यही आज का चिंतन है। शांति से इस पर मनन कीजिए।`,
  ].join(" ");
}

/**
 * Converts a Hindi-translated chat reply (markdown + verse blockquotes)
 * into a flat narration script. Strips structural markup the engine
 * would otherwise read literally and rewrites verse references into
 * spoken Devanagari ("Bhagavad Gita 6.17" -> "भगवद गीता, अध्याय 6, श्लोक 17").
 *
 * IAST transliteration lines (`> _yuktāhāra-vihārasya..._`) are dropped:
 * a hi-IN voice cannot pronounce Roman-script Sanskrit and saying it
 * out loud sounds like garbled English consonants.
 */
export function buildChatNarration(hindi: string): string {
  const lines = hindi.split("\n");
  const out: string[] = [];
  let verseBlock: string[] = [];

  const flushVerse = () => {
    if (verseBlock.length === 0) return;
    const spoken = verseBlock
      .map((l) => l.replace(/^>\s?/, ""))
      .filter((l) => !/^_.+_$/.test(l.trim()))
      .map((l) => l.replace(/\*\*([^*]+)\*\*/g, "$1"))
      .map((l) => l.replace(/_([^_]+)_/g, "$1"))
      .map((l) => l.replace(/^["“](.+)["”]$/, "$1"))
      .map((l) =>
        l.replace(
          /Bhagavad Gita\s*(\d+)\.(\d+)/gi,
          "भगवद गीता, अध्याय $1, श्लोक $2"
        )
      )
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("। ");
    if (spoken) out.push(spoken);
    verseBlock = [];
  };

  for (const line of lines) {
    if (/^>\s?/.test(line)) {
      verseBlock.push(line);
      continue;
    }
    flushVerse();
    const cleaned = line
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    if (cleaned) out.push(cleaned);
  }
  flushVerse();

  return out.join(" ");
}
