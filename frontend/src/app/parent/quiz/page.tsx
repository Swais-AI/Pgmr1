'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { fetchQuizHistory, fetchConversations } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation } from '@/lib/multilingual';

type QuizDetail = {
  quiz_id: number;
  quiz_title: string;
  subject: string;
  score: string;
  total: string;
  percentage: number;
  teacher_name: string;
  remarks: string;
  quiz_date: string;
  status: string;
  suggestion: string;
};

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string; hex: string }> = {
  'Excellent': { text: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', hex: '#22C55E' },
  'Good': { text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', hex: '#3B82F6' },
  'Average': { text: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', hex: '#F97316' },
  'Needs Improvement': { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA', hex: '#EF4444' },
};

const TABS = ['All', 'Excellent', 'Good', 'Average', 'Needs Improvement'] as const;

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

const CircularProgress = ({ pct, colorHex }: { pct: number; colorHex: string }) => {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circum = radius * 2 * Math.PI;
  const offset = circum - (pct / 100) * circum;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke={colorHex} strokeWidth={stroke} fill="none" 
          strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-black" style={{ color: colorHex }}>{Math.round(pct)}%</span>
    </div>
  );
};

export default function QuizPerformancePage() {
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tab, setTab] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [subj, setSubj] = useState('All');
  const [modalData, setModalData] = useState<QuizDetail | null>(null);
  const [talkLoading, setTalkLoading] = useState(false);

  useEffect(() => {
    if (!studentId) return; // wait for real studentId
    const load = async () => {
      setIsLoading(true);
      setModalData(null);
      setTab('All');
      setSearch('');
      setSubj('All');
      try {
        console.log('[SGS] Quiz: fetching for student_id', studentId);
        const data = await fetchQuizHistory(studentId);
        setQuizzes(data);
      } catch (e) {
        console.error('[SGS] Quiz: failed to load quizzes', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [studentId]);

  const subjects = useMemo(() => ['All', ...Array.from(new Set(quizzes.map(q => q.subject)))], [quizzes]);

  const filtered = useMemo(() => quizzes.filter(q => {
    if (tab !== 'All' && q.status !== tab) return false;
    if (subj !== 'All' && q.subject !== subj) return false;
    if (search) {
      const qs = search.toLowerCase();
      if (!q.quiz_title.toLowerCase().includes(qs) && !q.subject.toLowerCase().includes(qs)) return false;
    }
    return true;
  }), [quizzes, tab, subj, search]);

  // ── Translation: quiz list (parallel arrays indexed by filtered position) ─
  const filteredTitleTexts   = useMemo(() => filtered.map(q => q.quiz_title),   [filtered]);
  const filteredSubjectTexts = useMemo(() => filtered.map(q => q.subject),       [filtered]);

  const { displayed: dispQuizTitles   } = useTranslation(filteredTitleTexts,   language);
  const { displayed: dispQuizSubjects } = useTranslation(filteredSubjectTexts, language);

  // ── Translation: open modal (flat array, indexed 0-4) ──────────────────
  // [0] quiz_title  [1] subject  [2] teacher_name  [3] suggestion  [4] remarks
  const modalQuizTexts = useMemo(() => modalData ? [
    modalData.quiz_title,
    modalData.subject,
    modalData.teacher_name,
    modalData.suggestion,
    modalData.remarks,
  ] : [], [modalData]);

  const { displayed: dQM } = useTranslation(modalQuizTexts, language);

  const avgScore = quizzes.length ? quizzes.reduce((a, b) => a + b.percentage, 0) / quizzes.length : 0;
  const highest = quizzes.length ? Math.max(...quizzes.map(q => q.percentage)) : 0;
  const lowest = quizzes.length ? Math.min(...quizzes.map(q => q.percentage)) : 0;

  // Talk to Teacher — reuses Communication Center exactly like Assignment → Ask Teacher.
  // Checks for an existing thread first; opens it if found, creates a new one otherwise.
  const handleTalkToTeacher = async (quiz: QuizDetail) => {
    const threadSubject = `Re: Quiz Discussion - ${quiz.quiz_title}`;
    setTalkLoading(true);
    try {
      const convs = await fetchConversations(studentId, parentId);
      const existing = convs.find(
        (c: { subject: string }) => c.subject.trim() === threadSubject.trim()
      );
      if (existing) {
        // Open the existing thread directly
        router.push(`/parent/communication?conv=${existing.conv_id}`);
      } else {
        // Open the New Conversation modal pre-filled with quiz subject
        router.push(
          `/parent/communication?new=1&subject=${encodeURIComponent(threadSubject)}&category=Academic`
        );
      }
      setModalData(null);
    } catch {
      // Fallback: just open communication with new modal
      router.push(
        `/parent/communication?new=1&subject=${encodeURIComponent(threadSubject)}&category=Academic`
      );
      setModalData(null);
    } finally {
      setTalkLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col font-sans">
      <TopBar studentId={studentId} setStudentId={setStudentId} parentId={parentId} language={language} setLanguage={setLanguage} isLoading={isLoading} />

      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── HEADER ── */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-black text-white leading-tight">Quiz Performance</h1>
              <p className="text-sm font-medium text-slate-400 mt-1">Overview of quiz results across all subjects.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
            </div>
          ) : (
            <>
              {/* ── SUMMARY CARDS ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'Average Score', v: `${avgScore.toFixed(1)}%`, s: 'Overall performance' },
                  { l: 'Highest Score', v: `${highest}%`, s: 'Top result' },
                  { l: 'Lowest Score', v: `${lowest}%`, s: 'Needs focus' },
                  { l: 'Quizzes Attempted', v: quizzes.length.toString(), s: 'Total count' },
                ].map(c => (
                  <div key={c.l} className="bg-white/5 rounded-2xl border border-white/10 p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{c.l}</p>
                    <p className="text-3xl font-black text-white">{c.v}</p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">{c.s}</p>
                  </div>
                ))}
              </div>

              {/* ── FILTER BAR ── */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-3 flex flex-wrap items-center gap-3">
                <select value={subj} onChange={e => setSubj(e.target.value)}
                  className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none min-w-[140px]">
                  {subjects.map(s => <option key={s} value={s}>{s === 'All' ? 'All Subjects' : s}</option>)}
                </select>
                <div className="flex-1 relative min-w-[200px]">
                  <span className="absolute left-3 top-2.5 text-sm text-slate-400">🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search quizzes..."
                    className="w-full bg-slate-800 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm font-medium text-white outline-none placeholder:text-slate-500" />
                </div>
              </div>

              {/* ── TABS ── */}
              <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar">
                {TABS.map(t => {
                  const count = t === 'All' ? quizzes.length : quizzes.filter(q => q.status === t).length;
                  const active = tab === t;
                  return (
                    <button key={t} onClick={() => setTab(t)}
                      className="px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 -mb-px flex items-center gap-2 transition-colors"
                      style={{
                        borderColor: active ? '#EA580C' : 'transparent',
                        color: active ? '#EA580C' : '#94A3B8'
                      }}>
                      {t}
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: active ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.08)', color: active ? '#EA580C' : '#94A3B8' }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── QUIZ GRID ── */}
              {filtered.length === 0 ? (
                <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/10 border-dashed">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-white font-bold">No quizzes found.</p>
                  <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map((q, idx) => {
                    const c = STATUS_COLORS[q.status] || STATUS_COLORS['Average'];
                    return (
                      <div key={q.quiz_id} onClick={() => setModalData(q)}
                        className="bg-white/5 rounded-2xl border border-white/10 p-5 hover:bg-white/10 transition-all cursor-pointer group flex items-start gap-4">
                        <CircularProgress pct={q.percentage} colorHex={c.hex} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: c.hex }}>{dispQuizSubjects[idx] ?? q.subject}</p>
                          <h3 className="text-base font-black text-white truncate group-hover:text-orange-400 transition-colors">{dispQuizTitles[idx] ?? q.quiz_title}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <p className="text-xs font-bold text-slate-400">{fmt(q.quiz_date)}</p>
                            <p className="text-xs font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-md">
                              {q.score} / {q.total}
                            </p>
                          </div>
                          <span className="inline-block mt-3 text-[10px] font-black px-2 py-1 rounded-lg"
                            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                            {q.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {modalData && (() => {
        const c = STATUS_COLORS[modalData.status] || STATUS_COLORS['Average'];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setModalData(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
            <div className="relative bg-slate-800 rounded-3xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden z-[110] border border-white/10"
              onClick={e => e.stopPropagation()}>

              <div className="shrink-0 p-6 pb-0 flex justify-between items-start">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-white/10">📋</div>
                <button onClick={() => setModalData(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors text-xl font-bold">×</button>
              </div>

              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-2xl font-black text-white leading-tight">{dQM[0] ?? modalData.quiz_title}</h2>
                <p className="text-sm font-bold text-slate-400 mt-1">{dQM[1] ?? modalData.subject} • Conducted on {fmt(modalData.quiz_date)}</p>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">

                {/* Result Block */}
                <div className="flex items-center gap-5 p-4 rounded-2xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <CircularProgress pct={modalData.percentage} colorHex={c.hex} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: c.hex }}>{modalData.status}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: c.text }}>Marks: {modalData.score} out of {modalData.total}</p>
                  </div>
                </div>

                {/* Details Grid */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Quiz Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teacher</p>
                      <p className="text-sm font-bold text-white">{dQM[2] ?? modalData.teacher_name}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</p>
                      <p className="text-sm font-bold text-white">{dQM[1] ?? modalData.subject}</p>
                    </div>
                  </div>
                </div>

                {/* Remarks & Suggestion */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Teacher Insights</p>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-1">Status Feedback</p>
                      <p className="text-sm font-bold text-white">{dQM[3] ?? modalData.suggestion}</p>
                    </div>
                    {modalData.remarks && modalData.remarks !== modalData.suggestion && (
                      <div className="pt-3 border-t border-white/10">
                        <p className="text-xs font-bold text-slate-400 mb-1">Specific Remarks</p>
                        <p className="text-sm font-medium text-slate-300 italic">"{dQM[4] ?? modalData.remarks}"</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ── MODAL FOOTER ── */}
              <div className="shrink-0 px-6 py-4 border-t border-white/10 flex gap-3 bg-white/5">
                <button
                  onClick={() => setModalData(null)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/10 text-slate-300"
                  style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                >
                  Close
                </button>
                <button
                  onClick={() => handleTalkToTeacher(modalData!)}
                  disabled={talkLoading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ color: '#1D4ED8', borderColor: '#BFDBFE', background: '#EFF6FF' }}
                >
                  {talkLoading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" />
                      Opening…
                    </>
                  ) : (
                    <>💬 Talk to Teacher</>
                  )}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
