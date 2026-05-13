'use client';

import { useState, useEffect, useMemo } from 'react';
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
};

export default function NoticesHistory() {
  const { studentId, setStudentId, language, setLanguage } = useDashboard();
  const [notices,     setNotices]     = useState<NoticeData[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [filterClass, setFilterClass] = useState('All Classes');

  const { speaking, speak, fallbackLang } = useTTS();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setFilterClass('All Classes');
      try {
        const result = await fetchNoticesHistory(studentId);
        setNotices(result || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [studentId]);

  const classes = useMemo(
    () => ['All Classes', ...Array.from(new Set(notices.map(n => n.applicable_class)))],
    [notices],
  );

  const filtered = useMemo(() => {
    if (filterClass === 'All Classes') return notices;
    return notices.filter(n => n.applicable_class === filterClass);
  }, [notices, filterClass]);

  // Stable key string so useTranslation only re-runs when IDs actually change
  const idKey = useMemo(
    () => filtered.map(n => n.notice_id).join(','),
    [filtered],
  );

  const titleTexts = useMemo(
    () => filtered.map(n => n.notice_title),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idKey],
  );
  const bodyTexts = useMemo(
    () => filtered.map(n => n.notice_text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idKey],
  );

  const { displayed: displayedTitles, translating: translatingTitles } = useTranslation(titleTexts, language);
  const { displayed: displayedTexts,  translating: translatingBody   } = useTranslation(bodyTexts,  language);

  const translating = translatingTitles || translatingBody;

  return (
    <div className="min-h-full flex flex-col bg-[#F8FAFC] text-gray-800 font-sans">
      <TopBar studentId={studentId} setStudentId={setStudentId} language={language} setLanguage={setLanguage} isLoading={isLoading} />

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

            <div className="flex items-center gap-3 shrink-0">
              {translating && (
                <span className="text-[11px] text-orange-500 font-semibold flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin inline-block" />
                  Translating…
                </span>
              )}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
                <span className="text-gray-400">🔻</span>
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 min-w-[120px] cursor-pointer appearance-none"
                >
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
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
                const isNew        = index === 0 || index === 1;
                const displayTitle = displayedTitles[index] ?? notice.notice_title;
                const displayText  = displayedTexts[index]  ?? notice.notice_text;
                const ttsKey       = `notice_${notice.notice_id ?? index}`;
                const isFallback   = !!fallbackLang && speaking === ttsKey;

                return (
                  <div key={notice.notice_id || index} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 md:p-6 flex flex-col md:flex-row gap-5 items-start relative group">

                    {/* Left Icon */}
                    <div className="shrink-0 w-16 h-16 rounded-full bg-orange-50 border-[6px] border-[#FFF7ED] flex items-center justify-center text-orange-500 text-2xl hidden md:flex">
                      📢
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 pr-0 md:pr-40">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Mobile Icon */}
                        <div className="shrink-0 w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 text-lg md:hidden">
                          📢
                        </div>
                        <h3 className="font-black text-gray-900 text-lg leading-tight truncate break-words whitespace-normal">{displayTitle}</h3>
                      </div>

                      <p className="text-sm font-medium text-gray-600 leading-relaxed whitespace-pre-line mt-1 md:mt-2">
                        {displayText}
                      </p>

                      <p className="text-xs font-bold text-gray-400 mt-4">
                        Posted by: <span className="text-gray-600">{notice.posted_by_name}</span>
                      </p>
                    </div>

                    {/* Right Badges */}
                    <div className="absolute top-5 right-5 md:static flex flex-row md:flex-col items-center md:items-end gap-3 shrink-0">
                      {isNew && (
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
    </div>
  );
}
