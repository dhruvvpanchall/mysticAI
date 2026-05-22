/**
 * Classifier-only probe. Mirrors classifyGreeting() in app/api/chat/route.ts.
 * Confirms which messages get handled locally (greetings/farewells/thanks)
 * vs which fall through to the LLM (everything else).
 */
const GREETING_PHRASES = [
  [/\bgood\s*bye\b/g, "bye"],
  [/\bsee\s+(you|ya|u)(\s+(later|soon|around|tomorrow|tmrw))?\b/g, "bye"],
  [/\btalk\s+(to\s+you|2\s+u)\s+(later|soon)\b/g, "bye"],
  [/\bcatch\s+you\s+later\b/g, "bye"],
  [/\btake\s+care\b/g, "bye"],
  [/\bpeace\s+out\b/g, "bye"],
  [/\bgood\s+(morning|afternoon|evening|day|night)\b/g, "hello"],
  [/\bhare\s+krishna\b/g, "namaste"],
  [/\bwhat'?s\s+up\b/g, "hello"],
  [/\bhow\s+(are\s+you|s\s+it\s+going|do\s+you\s+do|are\s+u|r\s+u|have\s+you\s+been)\b/g, "hello"],
  [/\bwho\s+(are\s+you|r\s+u|are\s+u)\b/g, "whoareyou"],
  [/\bwhat\s+(can|do)\s+you\s+do\b/g, "whoareyou"],
  [/\bnice\s+to\s+meet\s+you\b/g, "hello"],
  [/\bthank\s+you\b/g, "thanks"],
];
const GREETING_WORDS = new Set([
  "hi","hii","hiii","hey","heyy","heyyy","hello","helo","hellow",
  "yo","hiya","sup","wassup","namaste","namaskar","pranam","greetings",
  "whoareyou","help","thanks","thank","thankyou","thx","ty",
  "ok","okay","k","cool","nice","great","good","test","testing",
  "there","friend","mystic","mysticai","ai","buddy","everyone","guru",
  "ji","bro","sir","maam","dear",
  "bye","byebye","goodbye","ttyl","cya","later","farewell","gn","gnight",
]);

function classify(msg) {
  const raw = msg.toLowerCase();
  let kind = "hello";
  if (/\b(bye|goodbye|byebye|ttyl|cya|farewell)\b/.test(raw)
      || /\bgood\s*bye\b/.test(raw)
      || /\bsee\s+(you|ya|u)\b/.test(raw)
      || /\btake\s+care\b/.test(raw)
      || /\btalk\s+(to\s+you|2\s+u)\s+(later|soon)\b/.test(raw)
      || /\bcatch\s+you\s+later\b/.test(raw)
      || /\bpeace\s+out\b/.test(raw)) kind = "farewell";
  else if (/\bgood\s+morning\b/.test(raw)) kind = "good_morning";
  else if (/\bgood\s+(afternoon|day)\b/.test(raw)) kind = "good_afternoon";
  else if (/\bgood\s+(evening|night)\b/.test(raw)) kind = "good_evening";
  else if (/\bhow\s+(are\s+you|s\s+it\s+going|do\s+you\s+do|are\s+u|r\s+u|have\s+you\s+been)\b/.test(raw)
        || /\bwhat'?s\s+up\b/.test(raw)) kind = "how_are_you";
  else if (/\bwho\s+(are\s+you|r\s+u|are\s+u)\b/.test(raw)
        || /\bwhat\s+(can|do)\s+you\s+do\b/.test(raw)) kind = "whoareyou";
  else if (/\b(thanks|thank\s+you|thank\s*u|thx|\bty\b|thankyou)\b/.test(raw)) kind = "thanks";

  let s = raw;
  for (const [re, tok] of GREETING_PHRASES) s = s.replace(re, tok);
  const cleaned = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return kind;
  const words = cleaned.split(" ");
  if (words.length > 6) return null;
  return words.every((w) => GREETING_WORDS.has(w)) ? kind : null;
}

const QUESTIONS = [
  // pure greetings — expect local
  "Hi","Hello","Hey","Good Morning","Good Afternoon","Good Evening","Good Night",
  "What's up?","How are you?","Who are you?","What can you do?",
  // thanks / farewell — expect local
  "Thank you","Thanks","Bye","See you later","Take care",
  // platform/meta — expect LLM (A.1)
  "What is MysticAI?","Are you real?","Are you human?","How do you help me?",
  "Can you solve my problems?","Can I talk to you freely?","Can you motivate me?",
  "Can you give life advice?","Can you help with relationships?","Can you help with stress?",
  "Can you help with anxiety?","Can you guide me spiritually?","Are you based on Bhagavad Gita?",
  "Can you answer according to Geeta?","Can you understand emotions?","Are my chats private?",
  "Are you a therapist?","Can you help me focus?","Can you help me make decisions?",
  "Can we be friends?","Will you judge me?","Do you love me?",
  "What should I call you?","Why were you created?","What makes you different from other AIs?",
  // brief life problems — expect LLM (B)
  "Tell me something positive","Motivate me","I feel sad","I feel lost","I feel lonely",
  "I overthink a lot","I need guidance","I need peace",
  // Gita-as-subject — expect LLM (A.2)
  "Who is Lord Krishna?","What does Bhagavad Gita teach?","What is karma in Bhagavad Gita?",
  "What is Karma Yoga?","What is Bhakti Yoga?","What is Jnana Yoga?","What is Dharma?",
  "Why did Krishna give the Gita?","Who wrote Bhagavad Gita?","When was Bhagavad Gita spoken?",
  "What is moksha?","What does Krishna say about ego?","What is the soul according to Gita?",
];

let local = 0, llm = 0;
for (const q of QUESTIONS) {
  const k = classify(q);
  const dest = k ? `LOCAL[${k}]` : "LLM";
  if (k) local++; else llm++;
  console.log(`${dest.padEnd(22)} ${q}`);
}
console.log(`\n${local} local, ${llm} LLM-bound`);
