import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const spiritualQuotes: { text: string; source: string }[] = [
  {
    text: "You have the right to perform your duty, but not to the results of your actions.",
    source: "Bhagavad Gita 2.47",
  },
  {
    text: "The Self is hidden in the hearts of all, as butter lies hidden in cream.",
    source: "Shvetashvatara Upanishad",
  },
  {
    text: "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.",
    source: "Bhagavad Gita 6.19",
  },
  {
    text: "Lead me from the unreal to the real, from darkness to light, from death to immortality.",
    source: "Brihadaranyaka Upanishad",
  },
  {
    text: "He who has no attachments can really love others, for his love is pure and divine.",
    source: "Ramayana",
  },
  {
    text: "The mind is restless, but it can be controlled through practice and detachment.",
    source: "Bhagavad Gita 6.35",
  },
];

export function pickQuote(seed?: number) {
  if (typeof seed === "number") {
    return spiritualQuotes[seed % spiritualQuotes.length];
  }
  return spiritualQuotes[Math.floor(Math.random() * spiritualQuotes.length)];
}
