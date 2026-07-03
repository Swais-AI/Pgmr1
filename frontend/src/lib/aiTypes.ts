// ── AI Service Types ──────────────────────────────────────────────────────
// All request/response shapes for communication with the AI repository.
// Pages and hooks consume AIServiceResult<T> only — never raw AI responses.

// ── Standardized result wrapper ───────────────────────────────────────────
// Every aiService function returns this shape. Pages never see `analysis`,
// `report`, `translation`, or `chartData` — only `data`.

export type AIServiceResult<T = string> =
  | { success: true;  data: T;     error: null;    source: 'ai' }
  | { success: false; data: null;  error: string;  source: 'ai' };

// ── userInfo shape expected by every AI endpoint ──────────────────────────

export interface AIUserInfo {
  id: number;
  name: string;
  email: string;
  role: 'Parent';
}

// ── /parent/assignments ───────────────────────────────────────────────────

export interface AIAssignmentReportRequest {
  userInfo: AIUserInfo;
}

// Raw shape returned by the AI server — used only inside aiService.ts
export interface _AIAssignmentReportRaw {
  report: string;
  list: unknown[];  // always ignored
}

// ── /parent/analytics ────────────────────────────────────────────────────

export type AIAnalyticsScope = 'all' | 'single';

export interface AIAnalyticsRequest {
  scope: AIAnalyticsScope;
  subject?: string;   // required when scope is 'single'
  userInfo: AIUserInfo;
}

// Raw shape returned by the AI server — used only inside aiService.ts
export interface _AIAnalyticsRaw {
  analysis: string;
  chartData: unknown[];  // always ignored
}

// ── /parent/translate ─────────────────────────────────────────────────────

export interface AITranslateRequest {
  text: string;
  targetLang: string;   // BCP-47 code — aiService maps to human name before sending
}

// Raw shape returned by the AI server — used only inside aiService.ts
export interface _AITranslateRaw {
  translation: string;
}

// Shape returned by aiService to callers — matches existing translateText contract
export interface AITranslateResponse {
  translated_text: string;
  original_text: string;
}
