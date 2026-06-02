/**
 * Server-side env validation for the STT provider. Today only the Whisper
 * model name is configurable — the Groq base URL + API key are already
 * resolved at the chat / translate routes, and we deliberately reuse the
 * same provider here to avoid a second account.
 *
 * Note: the GEMINI_API_KEY name is historical. The user's .env.local
 * points it at Groq, and Groq hosts the Whisper endpoint, so the same
 * key works for chat, translate, and transcription with no fan-out.
 */

const DEFAULT_WHISPER_MODEL = "whisper-large-v3-turbo";

export interface STTEnv {
  apiKey: string | null;
  baseURL: string;
  model: string;
}

let cached: STTEnv | null = null;

export function getSTTEnv(): STTEnv {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY?.trim() || null;
  const baseURL =
    process.env.LLM_BASE_URL?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta/openai/";
  const model = process.env.WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL;
  cached = { apiKey, baseURL, model };
  return cached;
}
