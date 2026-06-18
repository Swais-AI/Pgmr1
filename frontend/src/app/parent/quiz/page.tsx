'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { fetchQuizHistory, fetchConversations } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';

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
        <circle cx={size/2} cy={size/2} r={radius} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
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
    <div className="min-h-full flex flex-col font-sans bg-[#F9FAFB]">
      <TopBar studentId={studentId} setStudentId={setStudentId} parentId={parentId} language={language} setLanguage={setLanguage} isLoading={isLoading} />

      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── HEADER ── */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 leading-tight">Quiz Performance</h1>
              <p className="text-sm font-medium text-gray-500 mt-1">Overview of quiz results across all subjects.</p>
            </div>
            <button className="self-start md:self-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition shadow-sm flex items-center gap-2">
              <span>📥</span> Export
            </button>
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
                  <div key={c.l} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{c.l}</p>
                    <p className="text-3xl font-black text-gray-900">{c.v}</p>
                    <p className="text-xs font-semibold text-gray-400 mt-1">{c.s}</p>
                  </div>
                ))}
              </div>

              {/* ── FILTER BAR ── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
                <select value={subj} onChange={e => setSubj(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-lg px-3 py-2 outline-none min-w-[140px]">
                  {subjects.map(s => <option key={s} value={s}>{s === 'All' ? 'All Subjects' : s}</option>)}
                </select>
                <div className="flex-1 relative min-w-[200px]">
                  <span className="absolute left-3 top-2.5 text-sm text-gray-400">🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} 
                    placeholder="Search quizzes..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm font-medium text-gray-900 outline-none" />
                </div>
              </div>

              {/* ── TABS ── */}
              <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
                {TABS.map(t => {
                  const count = t === 'All' ? quizzes.length : quizzes.filter(q => q.status === t).length;
                  const active = tab === t;
                  return (
                    <button key={t} onClick={() => setTab(t)}
                      className="px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 -mb-px flex items-center gap-2 transition-colors"
                      style={{
                        borderColor: active ? '#EA580C' : 'transparent',
                        color: active ? '#EA580C' : '#6B7280'
                      }}>
                      {t}
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: active ? '#FFF7ED' : '#F3F4F6', color: active ? '#EA580C' : '#9CA3AF' }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── QUIZ GRID ── */}
              {filtered.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-gray-200 border-dashed">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-gray-900 font-bold">No quizzes found.</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map(q => {
                    const c = STATUS_COLORS[q.status] || STATUS_COLORS['Average'];
                    return (
                      <div key={q.quiz_id} onClick={() => setModalData(q)}
                        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-start gap-4">
                        <CircularProgress pct={q.percentage} colorHex={c.hex} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: c.hex }}>{q.subject}</p>
                          <h3 className="text-base font-black text-gray-900 truncate group-hover:text-orange-600 transition-colors">{q.quiz_title}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <p className="text-xs font-bold text-gray-400">{fmt(q.quiz_date)}</p>
                            <p className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
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
            <div className="relative bg-white rounded-3xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden z-[110]"
              onClick={e => e.stopPropagation()}>
              
              <div className="shrink-0 p-6 pb-0 flex justify-between items-start">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-gray-100">📋</div>
                <button onClick={() => setModalData(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors text-xl font-bold">×</button>
              </div>

              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-2xl font-black text-gray-900 leading-tight">{modalData.quiz_title}</h2>
                <p className="text-sm font-bold text-gray-400 mt-1">{modalData.subject} • Conducted on {fmt(modalData.quiz_date)}</p>
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
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Quiz Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teacher</p>
                      <p className="text-sm font-bold text-gray-900">{modalData.teacher_name}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Subject</p>
                      <p className="text-sm font-bold text-gray-900">{modalData.subject}</p>
                    </div>
                  </div>
                </div>

                {/* Remarks & Suggestion */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Teacher Insights</p>
                  <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400 mb-1">Status Feedback</p>
                      <p className="text-sm font-bold text-gray-900">{modalData.suggestion}</p>
                    </div>
                    {modalData.remarks && modalData.remarks !== modalData.suggestion && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-400 mb-1">Specific Remarks</p>
                        <p className="text-sm font-medium text-gray-700 italic">"{modalData.remarks}"</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ── MODAL FOOTER ── */}
              <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-3" style={{ background: '#FAFAFA' }}>
                <button
                  onClick={() => setModalData(null)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-gray-50"
                  style={{ color: '#6B7280', borderColor: '#E5E7EB' }}
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
