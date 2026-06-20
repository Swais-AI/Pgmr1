'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import SpeakBtn from '@/components/SpeakBtn';
import { fetchRemarksHistory } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation, useTTS } from '@/lib/multilingual';

type RemarkData = {
  remark_id: number;
  teacher_name: string;
  subject: string;
  comment: string;
  date: string;
  ticket_id?: number | null;
  is_read?: boolean;
};

const COLORS = [
  { dot: '#22C55E', bg: '#DCFCE7', text: '#166534' },
  { dot: '#3B82F6', bg: '#DBEAFE', text: '#1E3A8A' },
  { dot: '#F97316', bg: '#FFEDD5', text: '#9A3412' },
  { dot: '#A855F7', bg: '#F3E8FF', text: '#6B21A8' },
  { dot: '#EC4899', bg: '#FCE7F3', text: '#9D174D' },
];

const getInitials = (name: string) => {
  const parts = name.replace(/^(Mr\.|Mrs\.|Ms\.|Miss\.|Dr\.)\s*/i, '').trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
  return 'TR';
};

// ── localStorage helpers ──────────────────────────────────────────────────────

function getReadRemarkIds(studentId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`sgs_read_remarks_${studentId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveReadRemarkIds(studentId: number, ids: Set<number>) {
  try {
    localStorage.setItem(`sgs_read_remarks_${studentId}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// ── Remark Detail Modal ───────────────────────────────────────────────────────

function RemarkModal({
  remark,
  displayText,
  onClose,
  onTalkToTeacher,
}: {
  remark: RemarkData;
  displayText: string;
  onClose: () => void;
  onTalkToTeacher: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">💬</span>
            <div>
              <h3 className="font-bold text-gray-900">{remark.teacher_name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{remark.subject} · {remark.date}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-line">{displayText}</p>
        </div>
        <div className="px-6 pb-6 pt-2 shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#E5E7EB' }}
          >
            Close
          </button>
          <button
            onClick={onTalkToTeacher}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            style={{ color: '#7E22CE', background: '#F3E8FF', border: '1px solid #E9D5FF' }}
          >
            💬 Talk to Teacher
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RemarksHistory() {
  const router = useRouter();
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();
  const [remarks,     setRemarks]     = useState<RemarkData[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [subj,        setSubj]        = useState('All Subjects');
  const [readIds,     setReadIds]     = useState<Set<number>>(new Set());
  const [modalRemark, setModalRemark] = useState<{ remark: RemarkData; displayText: string } | null>(null);

  const { speaking, speak, fallbackLang } = useTTS();

  useEffect(() => {
    if (!studentId) return;
    setReadIds(getReadRemarkIds(studentId));
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const loadHistory = async () => {
      setIsLoading(true);
      setSubj('All Subjects');
      try {
        const result = await fetchRemarksHistory(studentId);
        setRemarks(result || []);
        const ids = new Set<number>((result || []).map((r: RemarkData) => r.remark_id));
        saveReadRemarkIds(studentId, ids);
        setReadIds(ids);
      } catch (err) {
        console.error('[SGS] Remarks: failed to load', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, [studentId]);

  const subjects = useMemo(
    () => ['All Subjects', ...Array.from(new Set(remarks.map(r => r.subject)))],
    [remarks],
  );

  const filtered = useMemo(() => {
    if (subj === 'All Subjects') return remarks;
    return remarks.filter(r => r.subject === subj);
  }, [remarks, subj]);

  const commentTexts = useMemo(
    () => filtered.map(r => r.comment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered.map(r => r.remark_id).join(',')],
  );

  const { displayed: translatedComments, translating } = useTranslation(commentTexts, language);

  const handleTalkToTeacher = (remark: RemarkData) => {
    setModalRemark(null);
    if (remark.ticket_id) {
      router.push(`/parent/communication?conv=${remark.ticket_id}`);
    } else {
      const s = encodeURIComponent(`Re: Teacher Remark - ${remark.subject}`);
      router.push(`/parent/communication?new=1&subject=${s}&category=Academic`);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-[#F8FAFC] text-gray-800 font-sans">
      <TopBar
        studentId={studentId}
        setStudentId={setStudentId}
        parentId={parentId}
        language={language}
        setLanguage={setLanguage}
        isLoading={isLoading}
      />

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl" style={{ color: '#A855F7' }}>💬</span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Teacher Remarks History</h1>
              </div>
              <p className="text-gray-500 font-medium mt-1 ml-11">
                View all remarks and feedback shared by teachers.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {translating && (
                <span className="text-[11px] text-purple-500 font-semibold flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin inline-block" />
                  Translating…
                </span>
              )}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
                <span className="text-gray-400">🔻</span>
                <select
                  value={subj}
                  onChange={e => setSubj(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 min-w-[120px] cursor-pointer appearance-none"
                >
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center h-64 items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-gray-200 border-dashed">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-900 font-bold text-lg">No remarks found.</p>
              <p className="text-gray-400 text-sm mt-1">Check back later for teacher feedback.</p>
            </div>
          ) : (
            <div className="relative pb-10">
              <div className="absolute left-[13px] top-5 bottom-0 w-0.5 bg-gray-200 z-0 hidden sm:block" />

              <div className={`space-y-6 relative z-10 transition-opacity duration-200 ${translating ? 'opacity-60' : 'opacity-100'}`}>
                {filtered.map((remark, index) => {
                  const colorConfig = COLORS[index % COLORS.length];
                  const initials    = getInitials(remark.teacher_name || 'TR');
                  const isUnread    = !readIds.has(remark.remark_id);
                  const displayText = translatedComments[index] ?? remark.comment;
                  const ttsKey      = `remark_${remark.remark_id ?? index}`;
                  const isFallback  = !!fallbackLang && speaking === ttsKey;

                  return (
                    <div key={remark.remark_id || index} className="flex gap-4 sm:gap-5 items-start relative">
                      {/* Timeline dot */}
                      <div className="hidden sm:flex shrink-0 w-7 flex-col items-center pt-5">
                        <div
                          className="w-3 h-3 rounded-full relative z-10"
                          style={{ backgroundColor: colorConfig.dot, boxShadow: '0 0 0 4px #F8FAFC' }}
                        />
                      </div>

                      {/* Content card — click to open modal */}
                      <div
                        onClick={() => setModalRemark({ remark, displayText })}
                        className={`flex-1 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 cursor-pointer ${isUnread ? 'border-purple-200' : 'border-gray-100'}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-black text-sm tracking-wider shrink-0"
                              style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
                            >
                              {initials}
                            </div>
                            <div>
                              <h3 className="font-black text-gray-900 text-sm sm:text-base leading-tight">
                                {remark.teacher_name}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                  {remark.subject}
                                </span>
                                <span className="text-[10px] sm:text-xs font-bold text-gray-400">
                                  {remark.date}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isUnread && (
                              <div className="bg-[#F3E8FF] text-[#7E22CE] text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md">
                                New
                              </div>
                            )}
                            <SpeakBtn
                              textKey={ttsKey}
                              speaking={speaking}
                              fallback={isFallback}
                              onSpeak={() => speak(displayText, language, ttsKey)}
                            />
                          </div>
                        </div>

                        {/* Remark preview text */}
                        <p className="text-sm font-medium text-gray-700 leading-relaxed sm:ml-14 line-clamp-3">
                          {displayText}
                        </p>

                        {/* Communication links */}
                        <div className="sm:ml-14 mt-3 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                          {remark.ticket_id ? (
                            <a
                              href={`/parent/communication?conv=${remark.ticket_id}`}
                              className="text-[11px] font-bold text-purple-600 hover:underline"
                            >
                              View full conversation →
                            </a>
                          ) : (
                            <button
                              onClick={() => handleTalkToTeacher(remark)}
                              className="text-[11px] font-bold text-purple-600 hover:underline"
                            >
                              💬 Talk to Teacher
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-1.5 mt-8 text-xs font-bold text-gray-400">
                <span>ⓘ</span> Showing latest remarks on top
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Remark detail modal */}
      {modalRemark && (
        <RemarkModal
          remark={modalRemark.remark}
          displayText={modalRemark.displayText}
          onClose={() => setModalRemark(null)}
          onTalkToTeacher={() => handleTalkToTeacher(modalRemark.remark)}
        />
      )}
    </div>
  );
}
