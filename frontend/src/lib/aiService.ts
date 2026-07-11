// ── AI Service Layer ──────────────────────────────────────────────────────
// The ONLY file in the Parent Dashboard that communicates with the AI server.
// Pages and hooks never import the AI URL or call AI endpoints directly.
//
// Responsibilities:
//   • Environment config & feature-flag gate
//   • 15-second timeout on every call
//   • parentId zero-guard (prevents silent parentId=1 default on AI server)
//   • BCP-47 → human language name mapping for /translate
//   • HTTP 200 failure detection for /analytics (AI server quirk)
//   • Strip redundant fields (`list`, `chartData`) before returning
//   • 15-minute in-memory response cache
//   • Standardized AIServiceResult<T> — callers never see raw AI shapes

import type {
  AIServiceResult,
  AIUserInfo,
  AIAssignmentReportRequest,
  AIAnalyticsRequest,
  AITranslateRequest,
  AITranslateResponse,
  AISpeakRequest,
  _AIAssignmentReportRaw,
  _AIAnalyticsRaw,
  _AITranslateRaw,
  _AISpeakRaw,
} from './aiTypes';

// ── Environment ───────────────────────────────────────────────────────────

const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL ?? '';
const AI_ENABLED  = process.env.NEXT_PUBLIC_ENABLE_AI === 'true';
const TIMEOUT_MS  = 15_000;
const CACHE_TTL   = 15 * 60 * 1000; // 15 minutes

// ── Internal cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const _cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet<T>(key: string, data: T): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ── Helpers ───────────────────────────────────────────────────────────────

const LANG_CODE_TO_NAME: Record<string, string> = {
  te: 'Telugu',
  hi: 'Hindi',
  or: 'Odia',
  en: 'English',
};

function disabled<T>(): AIServiceResult<T> {
  return { success: false, data: null, error: 'disabled', source: 'ai' };
}

function notReady<T>(): AIServiceResult<T> {
  return { success: false, data: null, error: 'not-ready', source: 'ai' };
}

function err<T>(message: string): AIServiceResult<T> {
  return { success: false, data: null, error: message, source: 'ai' };
}

function ok<T>(data: T): AIServiceResult<T> {
  return { success: true, data, error: null, source: 'ai' };
}

async function fetchWithTimeout(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch AI-generated assignment report for a parent.
 * Returns only the `report` string — `list` is discarded.
 */
export async function fetchAIAssignmentReport(
  req: AIAssignmentReportRequest,
): Promise<AIServiceResult<string>> {
  if (!AI_ENABLED) return disabled();
  if (!AI_BASE_URL) return disabled();
  if (!req.userInfo.id || req.userInfo.id <= 0) return notReady();

  const cacheKey = `assignments:${req.userInfo.id}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return ok(cached);

  try {
    const res = await fetchWithTimeout(
      `${AI_BASE_URL}/parent/assignments`,
      { userInfo: req.userInfo },
    );
    if (!res.ok) return err(`http-${res.status}`);

    const raw: _AIAssignmentReportRaw = await res.json();
    const report = raw.report?.trim();
    if (!report) return err('empty-response');

    cacheSet(cacheKey, report);
    return ok(report);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return err('timeout');
    return err('network');
  }
}

/**
 * Fetch AI-generated analytics for a parent's child.
 * scope:"all"    → overall performance across subjects
 * scope:"single" → subject-specific insight (note: AI server has a SQL column
 *                  limitation on this scope — results are best-effort)
 * Returns only the `analysis` string — `chartData` is discarded.
 */
export async function fetchAIAnalytics(
  req: AIAnalyticsRequest,
): Promise<AIServiceResult<string>> {
  if (!AI_ENABLED) return disabled();
  if (!AI_BASE_URL) return disabled();
  if (!req.userInfo.id || req.userInfo.id <= 0) return notReady();

  const cacheKey = `analytics:${req.userInfo.id}:${req.scope}:${req.subject ?? ''}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return ok(cached);

  try {
    const body: Record<string, unknown> = { scope: req.scope, userInfo: req.userInfo };
    if (req.scope === 'single' && req.subject) body.subject = req.subject;

    const res = await fetchWithTimeout(
      `${AI_BASE_URL}/parent/analytics`,
      body,
    );
    if (!res.ok) return err(`http-${res.status}`);

    const raw: _AIAnalyticsRaw = await res.json();
    const analysis = raw.analysis?.trim();
    if (!analysis) return err('empty-response');

    // chartData is intentionally ignored — the Dashboard renders its own analytics.
    // Any non-empty analysis string is treated as a successful response.
    cacheSet(cacheKey, analysis);
    return ok(analysis);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return err('timeout');
    return err('network');
  }
}

/**
 * Translate text via the AI repository's translate endpoint.
 * Accepts BCP-47 `targetLang` — maps to human name before sending.
 * Returns `{ translated_text, original_text }` to match the existing
 * translateText contract in api.ts.
 */
export async function translateWithAI(
  req: AITranslateRequest,
): Promise<AIServiceResult<AITranslateResponse>> {
  if (!AI_ENABLED) return disabled();
  if (!AI_BASE_URL) return disabled();
  if (!req.text?.trim()) return ok({ translated_text: req.text, original_text: req.text });

  // English short-circuit — no call needed
  if (req.targetLang === 'en') {
    return ok({ translated_text: req.text, original_text: req.text });
  }

  const humanLang = LANG_CODE_TO_NAME[req.targetLang];
  if (!humanLang) {
    // Unsupported language code — return original text gracefully
    return ok({ translated_text: req.text, original_text: req.text });
  }

  const cacheKey = `translate:${req.targetLang}:${req.text}`;
  const cached = cacheGet<AITranslateResponse>(cacheKey);
  if (cached) return ok(cached);

  try {
    const res = await fetchWithTimeout(
      `${AI_BASE_URL}/parent/translate`,
      { text: req.text, targetLanguage: humanLang },
    );
    if (!res.ok) return err(`http-${res.status}`);

    const raw: _AITranslateRaw = await res.json();
    const translated = raw.translation?.trim();
    if (!translated) return err('empty-response');

    const response: AITranslateResponse = {
      translated_text: translated,
      original_text: req.text,
    };
    cacheSet(cacheKey, response);
    return ok(response);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return err('timeout');
    return err('network');
  }
}

/**
 * Fetch AI-generated speech audio for a piece of text.
 * Accepts BCP-47 `targetLang` — maps to human name before sending.
 * Returns base64 MP3 on success; callers decode to audio.
 */
export async function speakWithAI(
  req: AISpeakRequest,
): Promise<AIServiceResult<string>> {
  if (!AI_ENABLED) return disabled();
  if (!AI_BASE_URL) return disabled();
  if (!req.text?.trim()) return err('empty-text');

  const humanLang = LANG_CODE_TO_NAME[req.targetLang] ?? 'English';

  const cacheKey = `speak:${req.targetLang}:${req.text}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return ok(cached);

  try {
    const res = await fetchWithTimeout(
      `${AI_BASE_URL}/parent/speak`,
      { text: req.text, language: humanLang },
    );
    if (!res.ok) return err(`http-${res.status}`);

    const raw: _AISpeakRaw = await res.json();
    const audioData = raw.audioData?.trim();
    if (!audioData) return err('empty-response');

    cacheSet(cacheKey, audioData);
    return ok(audioData);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return err('timeout');
    return err('network');
  }
}

/**
 * Build a standard AIUserInfo object from dashboard state.
 * Centralizes the userInfo construction so no page builds it manually.
 */
export function buildUserInfo(
  parentId: number,
  name = 'Parent',
  email = '',
): AIUserInfo {
  return { id: parentId, name, email, role: 'Parent' };
}

/**
 * Invalidate a specific cache entry (e.g. when studentId changes).
 * Pass the same key used internally: "assignments:42", "analytics:42:all:"
 */
export function invalidateAICache(key: string): void {
  _cache.delete(key);
}

/** Clear the entire AI cache (e.g. on logout or child switch). */
export function clearAICache(): void {
  _cache.clear();
}
