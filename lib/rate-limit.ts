/**
 * In-memory token-bucket rate limiter for API routes.
 *
 * Per-IP buckets, refilled at a fixed rate, with a hard ceiling. Designed
 * for the abuse-deterrence threshold ("don't let one bad actor burn the
 * Groq quota for everyone"), NOT for fine-grained per-user fairness.
 *
 * Caveats:
 *   - In-memory means buckets reset on cold-start and aren't shared across
 *     Vercel serverless instances. Good enough for MVP; swap to Upstash
 *     Redis / Vercel KV before serious traffic if needed.
 *   - IP is read from x-forwarded-for (Vercel sets this). Behind a proxy
 *     with no header, we fall back to a single "unknown" bucket — which
 *     means an unconfigured proxy will rate-limit globally. That's the
 *     safer default than no limit at all.
 */
import { NextRequest } from "next/server";

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

interface LimiterConfig {
  /** Bucket size = max burst. */
  capacity: number;
  /** Tokens regenerated per second. */
  refillPerSecond: number;
}

const buckets = new Map<string, Bucket>();

/** Read the client IP from Vercel-style proxy headers; fall back to a stub. */
export function clientKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * Decrement one token for `key`. Returns { ok: true } if the request may
 * proceed, or { ok: false, retryAfterMs } if rate-limited.
 */
export function takeToken(
  key: string,
  cfg: LimiterConfig
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: cfg.capacity, lastRefillMs: now };
    buckets.set(key, b);
  }
  const elapsedSec = (now - b.lastRefillMs) / 1000;
  if (elapsedSec > 0) {
    b.tokens = Math.min(cfg.capacity, b.tokens + elapsedSec * cfg.refillPerSecond);
    b.lastRefillMs = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true };
  }
  const need = 1 - b.tokens;
  const waitSec = need / cfg.refillPerSecond;
  return { ok: false, retryAfterSec: Math.ceil(waitSec) };
}

/** 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(
    "Too many requests. Take a breath and try again in a moment.",
    {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}

/* Tuned limits — generous enough that an enthusiastic seeker never hits
 * them, tight enough that a script can't drain the LLM quota. */
export const CHAT_LIMIT: LimiterConfig = {
  capacity: 20,           // up to 20-message burst
  refillPerSecond: 20 / 60, // ~1 every 3 seconds steady-state
};
export const TRANSLATE_LIMIT: LimiterConfig = {
  capacity: 30,           // translations are per-message; allow a brisk re-render
  refillPerSecond: 30 / 60,
};
export const TRANSCRIBE_LIMIT: LimiterConfig = {
  capacity: 20,           // 20 short utterances in burst, then ~1/4s steady
  refillPerSecond: 20 / 60,
};
