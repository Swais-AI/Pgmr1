'use client';

// Reusable panel for displaying AI-generated insights.
// Used by: Dashboard (scope:all), Assignments, Assessments modal, Quiz modal.
// Renders four states: idle → button, loading → spinner, error → message, success → text.

type Status = 'idle' | 'loading' | 'success' | 'error' | 'disabled';

interface AIInsightPanelProps {
  status: Status;
  analysis: string | null;
  errorType?: string | null;
  onGenerate: () => void;
  /** Primary button label shown in idle state */
  buttonLabel?: string;
  /** Section label shown above the AI text in success state */
  insightLabel?: string;
}

export default function AIInsightPanel({
  status,
  analysis,
  errorType,
  onGenerate,
  buttonLabel  = 'Generate AI Insight',
  insightLabel = 'AI Insight',
}: AIInsightPanelProps) {
  if (status === 'disabled') return null;

  // ── Idle: show generate button ──────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className="flex items-center justify-center py-6">
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
          style={{ background: '#F97316' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EA580C')}
          onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
        >
          <span>✨</span>
          {buttonLabel}
        </button>
      </div>
    );
  }

  // ── Loading: show spinner ────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div
          className="w-7 h-7 rounded-full border-[3px] border-t-transparent animate-spin"
          style={{ borderColor: '#FED7AA', borderTopColor: 'transparent' }}
        />
        <p className="text-sm text-gray-400 font-medium">Generating AI insight…</p>
        <p className="text-[11px] text-gray-300">This may take up to 15 seconds</p>
      </div>
    );
  }

  // ── Error: show non-intrusive message + retry button ─────────────────────
  if (status === 'error') {
    const message =
      errorType === 'timeout'
        ? 'AI insight timed out. Please try again.'
        : errorType === 'ai-unavailable'
        ? 'AI service is temporarily unavailable.'
        : 'AI insight is currently unavailable.';

    return (
      <div className="flex flex-col items-center justify-center py-6 gap-3">
        <p className="text-sm text-gray-400">{message}</p>
        <button
          onClick={onGenerate}
          className="text-sm font-bold px-4 py-1.5 rounded-lg border transition-colors"
          style={{ color: '#F97316', borderColor: '#FED7AA' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#FFF7ED')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Success: render AI text + regenerate button ──────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
          {insightLabel}
        </span>
        <button
          onClick={onGenerate}
          className="text-[11px] font-semibold text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-1"
        >
          <span>↻</span> Regenerate
        </button>
      </div>

      <div
        className="text-sm text-gray-700 leading-relaxed whitespace-pre-line rounded-xl p-4"
        style={{ background: '#FFF7ED', borderLeft: '3px solid #F97316' }}
      >
        {analysis}
      </div>
    </div>
  );
}
