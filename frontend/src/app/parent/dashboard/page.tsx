'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { fetchDashboardData } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation } from '@/lib/multilingual';

// ── Helpers ───────────────────────────────────────────────────────────────

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

function fmtDate(iso: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, href, iconBg,
}: {
  icon: string; label: string; value: string | number;
  sub?: string; href?: string; iconBg: string;
}) {
  const card = (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 transition-all ${href ? 'hover:border-orange-200 hover:shadow-md cursor-pointer' : ''}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-xl font-black text-gray-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {href && <span className="text-gray-300 text-base shrink-0">›</span>}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SectionCard({ title, children, action }: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        {action && (
          <Link href={action.href} className="text-[11px] text-orange-500 font-bold hover:underline shrink-0">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function AlertPill({ type, priority }: { type: string; priority?: string }) {
  const p = priority?.toUpperCase() ?? (type === 'warning' ? 'HIGH' : type === 'medium' ? 'MED' : 'LOW');
  const cls =
    p === 'HIGH'   ? 'text-red-600 bg-red-50' :
    p === 'MEDIUM' || p === 'MED' ? 'text-orange-600 bg-orange-50' :
    'text-green-700 bg-green-50';
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${cls}`}>{p}</span>
  );
}

function recIcon(type: string) {
  const map: Record<string, string> = {
    // attendance: '📅',  // removed – attendance module removed
    task: '📋', academic: '📘', praise: '🌟',
  };
  return map[type] ?? '💡';
}

function notifStyle(type: string): { icon: string; bg: string } {
  const map: Record<string, { icon: string; bg: string }> = {
    warning:      { icon: '⚠️', bg: 'bg-red-50' },
    announcement: { icon: '📢', bg: 'bg-blue-50' },
    success:      { icon: '✅', bg: 'bg-green-50' },
    info:         { icon: '💬', bg: 'bg-purple-50' },
    ticket_reply: { icon: '🎫', bg: 'bg-indigo-50' },
  };
  return map[type] ?? { icon: '🔔', bg: 'bg-gray-50' };
}

const BAR_COLORS = [
  'bg-green-500', 'bg-blue-500', 'bg-purple-500',
  'bg-yellow-500', 'bg-red-400', 'bg-teal-500',
];

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();
  const [data,      setData]      = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return; // wait for real studentId from localStorage / ChildSelector
    const load = async () => {
      setIsLoading(true); setError(null); setData(null);
      try {
        console.log('[SGS] Dashboard: fetching for student_id', studentId);
        setData(await fetchDashboardData(studentId));
      }
      catch { setError('Failed to load dashboard. Please try again.'); }
      finally { setIsLoading(false); }
    };
    load();
  }, [studentId]);

  // ── Extract real data ────────────────────────────────────────────────────
  const studentName    = data?.student?.full_name  ?? '';
  const className      = data?.student?.class_name ?? '';
  const section        = data?.student?.section    ?? '';
  // const attendancePct  = data?.attendance_trend?.percentage ?? '—'; // removed – attendance module removed
  // const attendanceHeat = data?.attendance_heat ?? '';               // removed – attendance module removed
  const pendingCount   = data?.daily_summary?.assignments_pending ?? 0;
  const noticesCount   = data?.daily_summary?.notices_today ?? 0;
  const alerts         = (data?.alerts                ?? []) as any[];
  const deadlines      = (data?.upcoming_deadlines    ?? []) as any[];
  const recs           = (data?.smart_recommendations ?? []) as any[];
  const notifications  = (data?.notifications         ?? []) as any[];
  const subjectPerf    = (data?.subject_performance   ?? []) as any[];
  const strongest      = data?.performance_summary?.strongest_subject ?? null;
  const weakest        = data?.performance_summary?.weakest_subject   ?? null;
  const avgScore       = data?.performance_summary?.avg_score         ?? null;

  // Compute avg quiz % from quiz list if schema field not yet populated
  const quizList   = (data?.quiz ?? []) as any[];
  const computedAvg = quizList.length > 0
    ? Math.round(
        quizList.reduce((acc: number, q: any) => {
          const s = parseFloat(q.score) || 0;
          const t = parseFloat(q.total) || 1;
          return acc + (s / t) * 100;
        }, 0) / quizList.length
      )
    : null;
  const displayAvg = avgScore ?? computedAvg;

  // Stable source arrays — only rebuild when underlying data changes
  const alertMsgTexts  = useMemo(() => alerts.map((a: any)   => a.message      ?? ''), [alerts]);
  const deadTitleTexts = useMemo(() => deadlines.map((d: any) => d.title        ?? ''), [deadlines]);
  const recMsgTexts    = useMemo(() => recs.map((r: any)      => r.message      ?? ''), [recs]);
  const recActionTexts = useMemo(() => recs.map((r: any)      => r.action_text  ?? ''), [recs]);

  const { displayed: dispAlertMsgs,    translating: translatingAlerts    } = useTranslation(alertMsgTexts,  language);
  const { displayed: dispDeadlineTitles, translating: translatingDeadlines } = useTranslation(deadTitleTexts, language);
  const { displayed: dispRecMsgs,      translating: translatingRecs      } = useTranslation(recMsgTexts,    language);
  const { displayed: dispRecActions }                                        = useTranslation(recActionTexts, language);

  const translating = translatingAlerts || translatingDeadlines || translatingRecs;

  // Learning Progress: combine assignment completion (60%) + quiz avg (40%)
  const assignmentCompletion = data?.assignment_completion_pct ?? null;
  const combinedLearning =
    assignmentCompletion !== null && displayAvg !== null
      ? Math.round(assignmentCompletion * 0.6 + displayAvg * 0.4)
      : assignmentCompletion !== null
        ? Math.round(assignmentCompletion)
        : displayAvg !== null
          ? Math.round(displayAvg)
          : null;
  const learningValue = combinedLearning !== null ? `${combinedLearning}%` : '—';
  const learningLabel =
    combinedLearning === null   ? 'Tracking progress'    :
    combinedLearning >= 80      ? 'Strong performance'   :
    combinedLearning >= 60      ? 'Good progress'        :
    combinedLearning >= 40      ? 'Needs improvement'    : 'Needs attention';

  const actionRequiredCount = data?.action_required_count ?? (alerts.filter((a: any) => a.priority === 'HIGH').length);

  return (
    <div className="min-h-full flex flex-col bg-[#F9FAFB] text-gray-800 font-sans">
      <TopBar
        studentId={studentId} setStudentId={setStudentId}
        parentId={parentId}
        language={language}   setLanguage={setLanguage}
        isLoading={isLoading}
      />

      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-4">

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-xl text-center border border-red-100">{error}</div>
          ) : (
            <>
              {/* ── Greeting ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-black text-base border-2 border-orange-100 shrink-0">
                  PS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{timeGreeting()},</p>
                  <p className="text-lg font-black text-gray-900 leading-tight">Priya Sharma 👋</p>
                  {studentName && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      Viewing <span className="font-semibold text-gray-700">{studentName}</span> Dashboard
                      {className && (
                        <span className="text-gray-400">
                          {' '}· Class {className}{section ? ` – ${section}` : ''}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Translating indicator */}
              {translating && (
                <div className="flex items-center gap-2 text-[11px] text-orange-500 font-semibold px-1">
                  <span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin inline-block" />
                  Translating content…
                </div>
              )}

              {/* ── Row 1: Quick Stats ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon="📈" label="Learning Progress" value={learningValue}
                  sub={learningLabel} iconBg="bg-purple-50"
                />
                <StatCard
                  icon="📋" label="Pending Tasks" value={pendingCount}
                  sub={pendingCount === 0 ? 'All caught up' : 'Assignments due'}
                  href="/parent/assignments" iconBg="bg-blue-50"
                />
                <StatCard
                  icon="🔔" label="Notices" value={noticesCount}
                  sub={noticesCount === 0 ? 'Nothing new' : 'New notices posted'}
                  href="/parent/notices" iconBg="bg-yellow-50"
                />
                <StatCard
                  icon="📊" label="Quiz Avg"
                  value={displayAvg !== null ? `${displayAvg}%` : '—'}
                  sub={
                    displayAvg === null   ? 'No quizzes yet'   :
                    displayAvg >= 70      ? 'Good performance'  :
                    displayAvg >= 50      ? 'Average'           : 'Needs attention'
                  }
                  href="/parent/quiz" iconBg="bg-green-50"
                />
              </div>

              {/* ── Row 2: Action Required + Upcoming Deadlines ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <SectionCard
                  title={actionRequiredCount > 0 ? `Action Required (${actionRequiredCount})` : 'Action Required'}
                  action={alerts.length > 0 ? { label: 'All Assignments →', href: '/parent/assignments' } : undefined}
                >
                  {alerts.length === 0 ? (
                    <EmptyState icon="✅" text="Nothing urgent right now." />
                  ) : (
                    <div className="space-y-2">
                      {alerts.slice(0, 5).map((a: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                        >
                          <AlertPill type={a.type} priority={a.priority} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {dispAlertMsgs[i] ?? a.message}
                            </p>
                            {a.subject && (
                              <p className="text-[11px] text-gray-400 truncate">{a.subject}</p>
                            )}
                          </div>
                          {a.due && (
                            <span className="text-[11px] text-gray-400 shrink-0">{a.due}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Upcoming Deadlines">
                  {deadlines.length === 0 ? (
                    <EmptyState icon="🎉" text="No upcoming deadlines." />
                  ) : (
                    <div className="space-y-2">
                      {deadlines.slice(0, 4).map((d: any, i: number) => {
                        const dateObj = d.due_date ? new Date(d.due_date) : null;
                        const mon     = dateObj?.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() ?? '';
                        const day     = dateObj?.getDate() ?? '';
                        const urgent  = d.days_left <= 2;
                        const warn    = d.days_left <= 5;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                          >
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[8px] font-black text-orange-400">{mon}</span>
                              <span className="text-sm font-black text-orange-600 leading-none">{day}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {dispDeadlineTitles[i] ?? d.title}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">{d.type}</p>
                            </div>
                            <span className={`text-[11px] font-bold shrink-0 ${urgent ? 'text-red-500' : warn ? 'text-orange-500' : 'text-gray-400'}`}>
                              {d.days_left === 0 ? 'Today' : `${d.days_left}d`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* ── Row 3: Performance Summary + Smart Recommendations ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <SectionCard
                  title="Performance Summary"
                  action={{ label: 'View Quizzes →', href: '/parent/quiz' }}
                >
                  {!strongest ? (
                    <EmptyState icon="📘" text="No quiz data available yet." />
                  ) : (
                    <>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <div className="flex-1 min-w-[80px] bg-green-50 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-gray-400 font-semibold">Strongest</p>
                          <p className="text-xs font-black text-green-700 mt-0.5 truncate">{strongest}</p>
                        </div>
                        <div className="flex-1 min-w-[80px] bg-red-50 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-gray-400 font-semibold">Needs Work</p>
                          <p className="text-xs font-black text-red-600 mt-0.5 truncate">{weakest}</p>
                        </div>
                        {displayAvg !== null && (
                          <div className="flex-1 min-w-[80px] bg-blue-50 rounded-xl p-2.5 text-center">
                            <p className="text-[10px] text-gray-400 font-semibold">Avg Score</p>
                            <p className="text-xs font-black text-blue-700 mt-0.5">{displayAvg}%</p>
                          </div>
                        )}
                      </div>

                      {subjectPerf.length > 0 ? (
                        <div className="space-y-2">
                          {subjectPerf.slice(0, 5).map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-24 shrink-0 truncate">{s.subject}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                                  style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-gray-600 w-9 text-right shrink-0">
                                {Math.round(s.score)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">
                          Subject breakdown unavailable.
                        </p>
                      )}
                    </>
                  )}
                </SectionCard>

                <SectionCard title="💡 Recommendations">
                  {recs.length === 0 ? (
                    <EmptyState icon="🌟" text="Everything looks great! Keep it up." />
                  ) : (
                    <div className="space-y-2">
                      {recs.slice(0, 4).map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-lg shrink-0 mt-0.5">{recIcon(r.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">
                              {dispRecMsgs[i] ?? r.message}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {dispRecActions[i] ?? r.action_text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* ── Row 4: Recent Activity ── */}
              <SectionCard
                title="🔔 Recent Activity"
                action={{ label: 'View Notices →', href: '/parent/notices' }}
              >
                {notifications.length === 0 ? (
                  <EmptyState icon="📭" text="No new notifications right now." />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {notifications.slice(0, 5).map((n: any, i: number) => {
                      const ns = notifStyle(n.type);
                      return (
                        <Link
                          key={i}
                          href={n.link || '#'}
                          className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all"
                        >
                          <div className={`w-9 h-9 rounded-full ${ns.bg} flex items-center justify-center text-lg shrink-0`}>
                            {ns.icon}
                          </div>
                          <p className="text-[11px] text-gray-700 font-medium leading-tight line-clamp-2">{n.title}</p>
                          <span className="text-[10px] text-gray-400">{fmtDate(n.date)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
