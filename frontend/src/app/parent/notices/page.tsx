'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import SpeakBtn from '@/components/SpeakBtn';
import { fetchNoticesHistory } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation, useTTS } from '@/lib/multilingual';

type NoticeData = {
  notice_id: number;
  notice_title: string;
  notice_text: string;
  notice_date: string;
  applicable_class: string;
  posted_by_name: string;
  is_read?: boolean;
};

// ── localStorage helpers ──────────────────────────────────────────────────────

function getReadNoticeIds(studentId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`sgs_read_notices_${studentId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveReadNoticeIds(studentId: number, ids: Set<number>) {
  try {
    localStorage.setItem(`sgs_read_notices_${studentId}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// ── Notice Detail Modal ───────────────────────────────────────────────────────

function NoticeModal({
  notice,
  displayTitle,
  displayText,
  onClose,
  onTalkToTeacher,
}: {
  notice: NoticeData;
  displayTitle: string;
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
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl shrink-0" style={{ color: '#F97316' }}>📢</span>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 break-words">{displayTitle}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Posted by {notice.posted_by_name} · {notice.notice_date}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none shrink-0 ml-3">×</button>
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
            style={{ color: '#EA580C', background: '#FFF7ED', border: '1px solid #FED7AA' }}
          >
            💬 Talk to Teacher
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NoticesHistory() {
  const router = useRouter();
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();
  const [notices,     setNotices]     = useState<NoticeData[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [readIds,     setReadIds]     = useState<Set<number>>(new Set());
  const [modalNotice, setModalNotice] = useState<{ notice: NoticeData; displayTitle: string; displayText: string } | null>(null);

  const { speaking, speak, fallbackLang } = useTTS();

  useEffect(() => {
    if (!studentId) return;
    setReadIds(getReadNoticeIds(studentId));
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const result = await fetchNoticesHistory(studentId);
        setNotices(result || []);
        // Do NOT auto-mark all as read here — that was the bug.
        // Read state is loaded from localStorage in the effect above.
      } catch (err) {
        console.error('[SGS] Notices: failed to load', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [studentId]);

  const filtered = notices;

  const idKey = useMemo(() => filtered.map(n => n.notice_id).join(','), [filtered]);
  const titleTexts = useMemo(() => filtered.map(n => n.notice_title), [idKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const bodyTexts  = useMemo(() => filtered.map(n => n.notice_text),  [idKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { displayed: displayedTitles, translating: translatingTitles } = useTranslation(titleTexts, language);
  const { displayed: displayedTexts,  translating: translatingBody   } = useTranslation(bodyTexts,  language);

  const translating = translatingTitles || translatingBody;

  // Auto-open a specific notice when navigated from the bell (?open=<notice_id>).
  // Reads window.location.search directly to avoid useSearchParams + Suspense requirement.
  // Runs once notices are loaded. Uses the same read logic as card clicks.
  useEffect(() => {
    if (typeof window === 'undefined' || notices.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    if (!openId) return;
    const targetId = parseInt(openId);
    if (isNaN(targetId)) return;
    const idx = notices.findIndex(n => n.notice_id === targetId);
    if (idx === -1) return;
    const notice = notices[idx];
    const displayTitle = displayedTitles[idx] ?? notice.notice_title;
    const displayText  = displayedTexts[idx]  ?? notice.notice_text;
    setModalNotice({ notice, displayTitle, displayText });
    // Inline mark-as-read (same logic as markNoticeRead) so the bell updates too
    setReadIds(prev => {
      if (prev.has(targetId)) return prev;
      const next = new Set(prev);
      next.add(targetId);
      saveReadNoticeIds(studentId, next);
      window.dispatchEvent(new CustomEvent('sgsNoticeRead', { detail: { noticeId: targetId, sid: studentId } }));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notices, displayedTitles, displayedTexts]);

  // Mark a single notice as read — updates local state, persists to localStorage,
  // and fires a custom event so TopBar bell updates immediately in the same tab.
  const markNoticeRead = (noticeId: number) => {
    if (readIds.has(noticeId)) return; // already read, skip
    const next = new Set(readIds);
    next.add(noticeId);
    setReadIds(next);
    saveReadNoticeIds(studentId, next);
    window.dispatchEvent(new CustomEvent('sgsNoticeRead', { detail: { noticeId, sid: studentId } }));
  };

  const handleTalkToTeacher = (notice: NoticeData) => {
    setModalNotice(null);
    const s = encodeURIComponent(`Re: Notice - ${notice.notice_title}`);
    router.push(`/parent/communication?new=1&subject=${s}&category=Academic`);
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
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl" style={{ color: '#F97316' }}>📢</span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Notices History</h1>
              </div>
              <p className="text-gray-500 font-medium mt-1 ml-11">All important notices and announcements.</p>
            </div>

            {translating && (
              <span className="text-[11px] text-orange-500 font-semibold flex items-center gap-1">
                <span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin inline-block" />
                Translating…
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center h-64 items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-gray-200 border-dashed">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-900 font-bold text-lg">No notices found.</p>
              <p className="text-gray-400 text-sm mt-1">There are no announcements for this class right now.</p>
            </div>
          ) : (
            <div className={`space-y-4 md:space-y-6 pb-10 transition-opacity duration-200 ${translating ? 'opacity-60' : 'opacity-100'}`}>
              {filtered.map((notice, index) => {
                const isUnread     = !readIds.has(notice.notice_id);
                const displayTitle = displayedTitles[index] ?? notice.notice_title;
                const displayText  = displayedTexts[index]  ?? notice.notice_text;
                const ttsKey       = `notice_${notice.notice_id ?? index}`;
                const isFallback   = !!fallbackLang && speaking === ttsKey;

                return (
                  <div
                    key={notice.notice_id || index}
                    onClick={() => {
                      markNoticeRead(notice.notice_id);
                      setModalNotice({ notice, displayTitle, displayText });
                    }}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-5 md:p-6 flex flex-col md:flex-row gap-5 items-start relative group cursor-pointer ${isUnread ? 'border-orange-200' : 'border-gray-100'}`}
                  >
                    {/* Left Icon */}
                    <div className="shrink-0 w-16 h-16 rounded-full bg-orange-50 border-[6px] border-[#FFF7ED] flex items-center justify-center text-orange-500 text-2xl hidden md:flex">
                      📢
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 pr-0 md:pr-40">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 text-lg md:hidden">
                          📢
                        </div>
                        <h3 className="font-black text-gray-900 text-lg leading-tight break-words whitespace-normal">{displayTitle}</h3>
                      </div>

                      <p className="text-sm font-medium text-gray-600 leading-relaxed whitespace-pre-line mt-1 md:mt-2 line-clamp-3">
                        {displayText}
                      </p>

                      <p className="text-xs font-bold text-gray-400 mt-4">
                        Posted by: <span className="text-gray-600">{notice.posted_by_name}</span>
                      </p>
                    </div>

                    {/* Right Badges */}
                    <div className="absolute top-5 right-5 md:static flex flex-row md:flex-col items-center md:items-end gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                      {isUnread && (
                        <div className="bg-[#EA580C] text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                          New
                        </div>
                      )}

                      <SpeakBtn
                        textKey={ttsKey}
                        speaking={speaking}
                        fallback={isFallback}
                        onSpeak={() => speak(`${displayTitle}. ${displayText}`, language, ttsKey)}
                      />

                      <div className="flex items-center gap-2 bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] px-3 py-1.5 rounded-lg">
                        <span className="text-sm">🗓️</span>
                        <span className="text-xs font-black tracking-wide">{notice.notice_date}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-center gap-1.5 mt-8 text-xs font-bold text-gray-400">
                <span>ⓘ</span> Showing latest notices on top
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notice detail modal */}
      {modalNotice && (
        <NoticeModal
          notice={modalNotice.notice}
          displayTitle={modalNotice.displayTitle}
          displayText={modalNotice.displayText}
          onClose={() => setModalNotice(null)}
          onTalkToTeacher={() => handleTalkToTeacher(modalNotice.notice)}
        />
      )}
    </div>
  );
}

