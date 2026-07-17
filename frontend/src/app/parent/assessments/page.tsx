'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import TopBar from '@/components/TopBar';
import { fetchAssessmentHistory } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import AIInsightPanel from '@/components/AIInsightPanel';
import { useAIAnalytics } from '@/hooks/useAIAnalytics';
import { useTranslation, useTranslatedText } from '@/lib/multilingual';

// ── Types ─────────────────────────────────────────────────────────────────────

type Assessment = {
  result_id: number;
  assessment_id: number;
  title: string;
  assessment_type: string;
  subject: string;
  chapter_name: string;
  teacher_name: string;
  assessment_date: string;   // "15 Jan 2025"
  date_iso: string;          // "2025-01-15"
  marks_obtained: number;
  max_marks: number;
  percentage: number;
  performance_badge: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string; hex: string }> = {
  'Excellent':          { text: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', hex: '#22C55E' },
  'Good':               { text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', hex: '#3B82F6' },
  'Average':            { text: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', hex: '#F97316' },
  'Needs Improvement':  { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA', hex: '#EF4444' },
};

const PIE_COLORS = [
  '#EA580C', '#3B82F6', '#22C55E', '#A855F7',
  '#EAB308', '#14B8A6', '#EF4444', '#F97316',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTERS: Record<string, number[]> = {
  'Quarter 1': [0, 1, 2],
  'Quarter 2': [3, 4, 5],
  'Quarter 3': [6, 7, 8],
  'Quarter 4': [9, 10, 11],
};

const TIMELINE_OPTIONS = [
  'All Time',
  'Current Academic Year',
  ...MONTH_NAMES,
  'Quarter 1',
  'Quarter 2',
  'Quarter 3',
  'Quarter 4',
  'Custom Date Range',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusColor = (badge: string) =>
  STATUS_COLORS[badge] ?? STATUS_COLORS['Average'];

// ── Sub-components ────────────────────────────────────────────────────────────

const CircularProgress = ({ pct, colorHex }: { pct: number; colorHex: string }) => {
  const size = 56, stroke = 5;
  const r = (size - stroke) / 2;
  const circum = r * 2 * Math.PI;
  const offset = circum - (Math.min(pct, 100) / 100) * circum;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={colorHex} strokeWidth={stroke} fill="none"
          strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-black" style={{ color: colorHex }}>{Math.round(pct)}%</span>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-3xl font-black text-white">{value}</p>
    <p className="text-xs font-semibold text-slate-400 mt-1">{sub}</p>
  </div>
);

// ── Skeleton placeholders ─────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-white/5 rounded-2xl border border-white/10 p-5 animate-pulse">
    <div className="h-3 bg-white/10 rounded w-2/3 mb-3" />
    <div className="h-8 bg-white/10 rounded w-1/2 mb-2" />
    <div className="h-3 bg-white/10 rounded w-1/3" />
  </div>
);

const SkeletonAssessmentCard = () => (
  <div className="bg-white/5 rounded-2xl border border-white/10 p-5 animate-pulse flex gap-4 items-start">
    <div className="w-14 h-14 rounded-full bg-white/10 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-white/10 rounded w-1/4" />
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-3 bg-white/10 rounded w-1/2" />
      <div className="h-6 bg-white/10 rounded w-1/3" />
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading]     = useState(true);

  const [subjectFilter,  setSubjectFilter]  = useState('All Subjects');
  const [timelineFilter, setTimelineFilter] = useState('All Time');
  const [customStart,    setCustomStart]    = useState('');
  const [customEnd,      setCustomEnd]      = useState('');

  const [modalData, setModalData] = useState<Assessment | null>(null);

  const { status: aiStatus, analysis: aiAnalysis, errorType: aiErrorType, generate: generateAI, reset: resetAI } =
    useAIAnalytics('single', parentId, modalData?.subject ?? '');

  // Reset AI state whenever a different assessment modal is opened
  const prevSubjectRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const subject = modalData?.subject;
    if (subject !== prevSubjectRef.current) {
      prevSubjectRef.current = subject;
      resetAI();
    }
  }, [modalData?.subject, resetAI]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setIsLoading(true);
      setModalData(null);
      setSubjectFilter('All Subjects');
      setTimelineFilter('All Time');
      setCustomStart('');
      setCustomEnd('');
      try {
        console.log('[SGS] Assessments: fetching for student_id', studentId);
        const data = await fetchAssessmentHistory(studentId);
        setAssessments(data ?? []);
      } catch (e) {
        console.error('[SGS] Assessments: failed to load', e);
        setAssessments([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [studentId]);

  // ── Derived subjects list ──────────────────────────────────────────────────

  const subjects = useMemo(
    () => ['All Subjects', ...Array.from(new Set(assessments.map(a => a.subject)))],
    [assessments],
  );

  // ── Client-side filter ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return assessments.filter(a => {
      if (subjectFilter !== 'All Subjects' && a.subject !== subjectFilter) return false;
      if (timelineFilter === 'All Time') return true;
      if (!a.date_iso) return true;

      const d   = new Date(a.date_iso);
      const now = new Date();
      const yr  = now.getFullYear();
      const mo  = now.getMonth(); // 0-indexed

      if (timelineFilter === 'Current Academic Year') {
        // Indian academic year: April → March
        const startYr   = mo >= 3 ? yr : yr - 1;
        const startDate = new Date(startYr, 3, 1); // 1 Apr
        return d >= startDate;
      }

      const monthIdx = MONTH_NAMES.indexOf(timelineFilter);
      if (monthIdx !== -1) {
        return d.getFullYear() === yr && d.getMonth() === monthIdx;
      }

      if (QUARTERS[timelineFilter]) {
        return QUARTERS[timelineFilter].includes(d.getMonth());
      }

      if (timelineFilter === 'Custom Date Range') {
        if (customStart && d < new Date(customStart)) return false;
        if (customEnd   && d > new Date(customEnd + 'T23:59:59')) return false;
        return true;
      }

      return true;
    });
  }, [assessments, subjectFilter, timelineFilter, customStart, customEnd]);

  // ── Translation: card list (parallel arrays indexed by filtered position) ─
  // Must be after `filtered` to avoid temporal dead zone on the deps array.
  const cardTitleTexts   = useMemo(() => filtered.map(a => a.title),             [filtered]);
  const cardChapterTexts = useMemo(() => filtered.map(a => a.chapter_name),      [filtered]);
  const cardTeacherTexts = useMemo(() => filtered.map(a => a.teacher_name),      [filtered]);
  const cardSubjectTexts = useMemo(() => filtered.map(a => a.subject),           [filtered]);
  const cardTypeTexts    = useMemo(() => filtered.map(a => a.assessment_type),   [filtered]);
  const cardBadgeTexts   = useMemo(() => filtered.map(a => a.performance_badge), [filtered]);

  const { displayed: dispTitles   } = useTranslation(cardTitleTexts,   language);
  const { displayed: dispChapters } = useTranslation(cardChapterTexts, language);
  const { displayed: dispTeachers } = useTranslation(cardTeacherTexts, language);
  const { displayed: dispSubjects } = useTranslation(cardSubjectTexts, language);
  const { displayed: dispTypes    } = useTranslation(cardTypeTexts,    language);
  const { displayed: dispBadges   } = useTranslation(cardBadgeTexts,   language);

  // ── Translation: open modal (flat array, indexed 0-5) ──────────────────
  // [0] title  [1] chapter  [2] teacher  [3] subject  [4] type  [5] badge
  const modalTextArr = useMemo(() => modalData ? [
    modalData.title,
    modalData.chapter_name,
    modalData.teacher_name,
    modalData.subject,
    modalData.assessment_type,
    modalData.performance_badge,
  ] : [], [modalData]);

  const { displayed: dM } = useTranslation(modalTextArr, language);

  // ── Translation: AI performance summary (single string, no English flash) ─
  const { displayed: translatedAISummary, translating: translatingAISummary } =
    useTranslatedText(aiAnalysis, language);
  const aiPanelStatus = aiStatus === 'success' && translatingAISummary ? 'loading' : aiStatus;

  // ── Summary cards ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!filtered.length) return { total: 0, avg: 0, highest: 0, lowest: 0 };
    const pcts = filtered.map(a => a.percentage);
    return {
      total:   filtered.length,
      avg:     pcts.reduce((s, v) => s + v, 0) / pcts.length,
      highest: Math.max(...pcts),
      lowest:  Math.min(...pcts),
    };
  }, [filtered]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const trendData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.date_iso.localeCompare(b.date_iso))
        .map(a => ({ label: a.assessment_date, percentage: a.percentage })),
    [filtered],
  );

  const subjectData = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const a of filtered) {
      (map[a.subject] = map[a.subject] ?? []).push(a.percentage);
    }
    return Object.entries(map).map(([subject, vals]) => ({
      subject,
      avg_percentage: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }));
  }, [filtered]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full flex flex-col font-sans">
      <TopBar
        studentId={studentId}
        setStudentId={setStudentId}
        parentId={parentId}
        language={language}
        setLanguage={setLanguage}
        isLoading={isLoading}
      />

      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── HEADER ────────────────────────────────────────────────────── */}
          <div>
            <h1 className="text-3xl font-black text-white leading-tight">Assessments</h1>
            <p className="text-sm font-medium text-slate-400 mt-1">
              View your child&apos;s assessment history and academic performance.
            </p>
          </div>

          {/* ── FILTER BAR ────────────────────────────────────────────────── */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Subject filter */}
              <select
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none min-w-[160px]"
              >
                {subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Timeline filter */}
              <select
                value={timelineFilter}
                onChange={e => { setTimelineFilter(e.target.value); setCustomStart(''); setCustomEnd(''); }}
                className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none min-w-[200px]"
              >
                {TIMELINE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {filtered.length > 0 && (
                <span className="text-xs font-semibold text-slate-400 ml-auto">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Custom date range inputs */}
            {timelineFilter === 'Custom Date Range' && (
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-400 whitespace-nowrap">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-400 whitespace-nowrap">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── LOADING ───────────────────────────────────────────────────── */}
          {isLoading ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map(i => <SkeletonAssessmentCard key={i} />)}
              </div>
            </>
          ) : (
            <>
              {/* ── SUMMARY CARDS ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total Assessments"
                  value={stats.total.toString()}
                  sub="Completed"
                />
                <StatCard
                  label="Average Percentage"
                  value={`${stats.avg.toFixed(1)}%`}
                  sub="Overall performance"
                />
                <StatCard
                  label="Highest Score"
                  value={`${stats.highest}%`}
                  sub="Top result"
                />
                <StatCard
                  label="Lowest Score"
                  value={`${stats.lowest}%`}
                  sub="Needs focus"
                />
              </div>

              {/* ── CHARTS ────────────────────────────────────────────────── */}
              {filtered.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Chart 1 — Performance Trend */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                      Performance Trend
                    </p>
                    <p className="text-sm font-bold text-slate-300 mb-4">
                      Percentage over time
                    </p>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendData}
                          margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                            angle={-40}
                            textAnchor="end"
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                            tickFormatter={(v: number) => `${v}%`}
                          />
                          <Tooltip
                            formatter={(v: unknown) => [`${v ?? 0}%`, 'Percentage']}
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: '#1e293b',
                              color: '#f1f5f9',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="percentage"
                            stroke="#EA580C"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#EA580C', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2 — Subject-wise Performance */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                      Subject-wise Performance
                    </p>
                    <p className="text-sm font-bold text-slate-300 mb-4">
                      Average percentage by subject
                    </p>
                    {subjectData.length > 0 ? (
                      <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={subjectData}
                              dataKey="avg_percentage"
                              nameKey="subject"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              label={((p: any) => `${p.name ?? ''} ${p.value ?? 0}%`) as any}
                              labelLine={{ stroke: '#D1D5DB' }}
                            >
                              {subjectData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: unknown) => [`${v ?? 0}%`, 'Avg %']}
                              contentStyle={{
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: '#1e293b',
                                color: '#f1f5f9',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            />
                            <Legend
                              iconType="circle"
                              iconSize={8}
                              wrapperStyle={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-60 flex items-center justify-center text-slate-400 text-sm font-semibold">
                        No data for selected filters
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ASSESSMENT CARDS ──────────────────────────────────────── */}
              {filtered.length === 0 ? (
                <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/10 border-dashed">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-white font-bold">No assessments found.</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Try adjusting your subject or timeline filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map((a, idx) => {
                    const c = statusColor(a.performance_badge);
                    return (
                      <div
                        key={a.result_id}
                        className="bg-white/5 rounded-2xl border border-white/10 p-5 hover:bg-white/10 transition-all flex items-start gap-4"
                      >
                        <CircularProgress pct={a.percentage} colorHex={c.hex} />

                        <div className="flex-1 min-w-0">
                          {/* Subject + type */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p
                              className="text-xs font-black uppercase tracking-wider"
                              style={{ color: c.hex }}
                            >
                              {dispSubjects[idx] ?? a.subject}
                            </p>
                            <span className="text-[10px] font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-md">
                              {dispTypes[idx] ?? a.assessment_type}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-base font-black text-white leading-snug line-clamp-2 mb-1">
                            {dispTitles[idx] ?? a.title}
                          </h3>

                          {/* Chapter */}
                          <p className="text-xs text-slate-400 font-semibold truncate mb-2">
                            📖 {dispChapters[idx] ?? a.chapter_name}
                          </p>

                          {/* Teacher + Date */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <p className="text-xs font-bold text-slate-400">
                              👤 {dispTeachers[idx] ?? a.teacher_name}
                            </p>
                            <span className="text-slate-600">·</span>
                            <p className="text-xs font-bold text-slate-400">
                              {a.assessment_date}
                            </p>
                          </div>

                          {/* Marks row */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-[10px] font-black px-2 py-1 rounded-lg"
                              style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                            >
                              {dispBadges[idx] ?? a.performance_badge}
                            </span>
                            <span className="text-xs font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-md shrink-0">
                              {a.marks_obtained} / {a.max_marks}
                            </span>
                          </div>

                          {/* View Details */}
                          <button
                            onClick={() => setModalData(a)}
                            className="mt-3 w-full text-xs font-bold py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-400 transition-colors"
                          >
                            View Details
                          </button>
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

      {/* ── DETAIL MODAL ──────────────────────────────────────────────────── */}
      {modalData && (() => {
        const c = statusColor(modalData.performance_badge);
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setModalData(null)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
            <div
              className="relative bg-slate-800 rounded-3xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden z-[110] border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header controls */}
              <div className="shrink-0 p-6 pb-0 flex justify-between items-start">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-white/10">
                  📝
                </div>
                <button
                  onClick={() => setModalData(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors text-xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Title block */}
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-2xl font-black text-white leading-tight">
                  {dM[0] ?? modalData.title}
                </h2>
                <p className="text-sm font-bold text-slate-400 mt-1">
                  {dM[4] ?? modalData.assessment_type} · {modalData.assessment_date}
                </p>
              </div>

              {/* Scrollable body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">

                {/* Result block */}
                <div
                  className="flex items-center gap-5 p-4 rounded-2xl"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <CircularProgress pct={modalData.percentage} colorHex={c.hex} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: c.hex }}>
                      {dM[5] ?? modalData.performance_badge}
                    </p>
                    <p className="text-sm font-bold mt-1" style={{ color: c.text }}>
                      {modalData.marks_obtained} out of {modalData.max_marks} marks
                    </p>
                  </div>
                </div>

                {/* Assessment details grid */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                    Assessment Information
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Subject',        value: dM[3] ?? modalData.subject },
                      { label: 'Chapter',        value: dM[1] ?? modalData.chapter_name },
                      { label: 'Teacher',        value: dM[2] ?? modalData.teacher_name },
                      { label: 'Assessment Type', value: dM[4] ?? modalData.assessment_type },
                      { label: 'Date',           value: modalData.assessment_date },
                      { label: 'Max Marks',      value: String(modalData.max_marks) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {label}
                        </p>
                        <p className="text-sm font-bold text-white leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Performance Summary */}
                <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">✨</span>
                    <p className="text-sm font-black text-white">AI Performance Summary</p>
                  </div>
                  <AIInsightPanel
                    status={aiPanelStatus}
                    analysis={translatedAISummary}
                    errorType={aiErrorType}
                    onGenerate={generateAI}
                    buttonLabel="Generate AI Summary"
                    insightLabel={`AI Insight — ${dM[3] ?? modalData?.subject ?? ''}`}
                  />
                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
