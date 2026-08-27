'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import ChildSelector from './ChildSelector';
import LanguageSelector from './LanguageSelector';
import { fetchNotifications } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellIcon, Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';

// ── localStorage helpers for client-side read tracking ───────────────────────

function getReadIds(studentId: number, kind: 'notif'): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`sgs_read_${kind}_${studentId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveReadIds(studentId: number, kind: 'notif', ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`sgs_read_${kind}_${studentId}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

function notifIcon(type: string) {
  const map: Record<string, string> = {
    ticket_reply:  '💬',
    announcement:  '📢',
    warning:       '⚠️',
    success:       '✅',
    info:          '💡',
  };
  return map[type] ?? '🔔';
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export default function TopBar({
  studentId, setStudentId, parentId = 0, language, setLanguage, isLoading = false,
}: any) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile,       setShowProfile]       = useState(false);
  const [notifications,     setNotifications]     = useState<any[]>([]);
  const [readIds,           setReadIds]            = useState<Set<string>>(new Set());

  const bellRef    = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Load notifications whenever studentId changes
  const loadNotifications = useCallback(async () => {
    if (!studentId) return;
    try {
      const data = await fetchNotifications(studentId);
      setNotifications(data ?? []);
    } catch { /* ignore */ }
  }, [studentId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Restore read state from localStorage on mount / studentId change.
  // Also merge in notice read states from the shared sgs_read_notices_ key
  // so that notices marked read on the Notices page are reflected in the bell.
  useEffect(() => {
    if (!studentId) return;
    const ids = getReadIds(studentId, 'notif');
    try {
      const raw = localStorage.getItem(`sgs_read_notices_${studentId}`);
      if (raw) {
        const noticeIds: number[] = JSON.parse(raw);
        for (const nid of noticeIds) ids.add(`not_${nid}`);
      }
    } catch { /* ignore */ }
    setReadIds(ids);
  }, [studentId]);

  // Real-time sync: when the Notices page marks a notice read (same tab),
  // it fires 'sgsNoticeRead'. We update readIds so the bell count drops immediately.
  useEffect(() => {
    const handler = (e: Event) => {
      const { noticeId, sid } = (e as CustomEvent).detail ?? {};
      if (sid !== studentId) return;
      setReadIds(prev => {
        const next = new Set(prev);
        next.add(`not_${noticeId}`);
        return next;
      });
    };
    window.addEventListener('sgsNoticeRead', handler);
    return () => window.removeEventListener('sgsNoticeRead', handler);
  }, [studentId]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showNotifications && !showProfile) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications, showProfile]);

  const unreadNotifications = notifications.filter((n: any) => !readIds.has(n.id));
  const unreadCount = unreadNotifications.length;

  const markOneRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    if (studentId) {
      saveReadIds(studentId, 'notif', next);
      // Sync notice reads to the shared sgs_read_notices_ key used by Notices page
      if (id.startsWith('not_')) {
        const noticeId = parseInt(id.slice(4));
        if (!isNaN(noticeId)) {
          try {
            const raw = localStorage.getItem(`sgs_read_notices_${studentId}`);
            const existing: Set<number> = raw ? new Set(JSON.parse(raw)) : new Set();
            existing.add(noticeId);
            localStorage.setItem(`sgs_read_notices_${studentId}`, JSON.stringify([...existing]));
          } catch { /* ignore */ }
        }
      }
    }
  };

  const markAllRead = () => {
    const next = new Set(notifications.map((n: any) => n.id as string));
    setReadIds(next);
    if (studentId) {
      saveReadIds(studentId, 'notif', next);
      // Sync all notice IDs to the shared sgs_read_notices_ key
      const noticeIds: number[] = [];
      for (const id of next) {
        if (id.startsWith('not_')) {
          const num = parseInt(id.slice(4));
          if (!isNaN(num)) noticeIds.push(num);
        }
      }
      if (noticeIds.length > 0) {
        try {
          const raw = localStorage.getItem(`sgs_read_notices_${studentId}`);
          const existing: Set<number> = raw ? new Set(JSON.parse(raw)) : new Set();
          for (const nid of noticeIds) existing.add(nid);
          localStorage.setItem(`sgs_read_notices_${studentId}`, JSON.stringify([...existing]));
        } catch { /* ignore */ }
      }
    }
  };

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 backdrop-blur-md p-4 border-b border-white/10 sticky top-0 z-20">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => window.dispatchEvent(new Event('sgsSidebarToggle'))}
            className="md:hidden text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <ChildSelector
            currentStudentId={studentId}
            onSelect={setStudentId}
            parentId={parentId}
            disabled={isLoading}
          />
          <LanguageSelector
            currentLang={language}
            onSelect={setLanguage}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-6 w-full md:w-auto justify-end">

          {/* ── Notification Bell ── */}
          <div ref={bellRef} className="relative">
            <button
              onClick={() => { setShowNotifications(p => !p); setShowProfile(false); }}
              className="relative text-slate-400 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <BellIcon className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-10 right-0 w-80 bg-slate-800 border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold text-white text-sm">
                    Notifications {unreadCount > 0 && <span className="text-orange-500">({unreadCount} new)</span>}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-orange-600 font-semibold hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {unreadNotifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="text-sm text-slate-400 font-medium">You&apos;re all caught up!</p>
                      <p className="text-xs text-slate-500 mt-1">No new notifications.</p>
                    </div>
                  ) : (
                    unreadNotifications.map((n: any) => (
                      <Link
                        key={n.id}
                        href={n.link || '#'}
                        onClick={() => { markOneRead(n.id); setShowNotifications(false); }}
                        className="p-4 border-b border-white/5 hover:bg-orange-500/10 transition-colors flex gap-3 items-start cursor-pointer block bg-orange-500/5"
                      >
                        <span className="text-xl shrink-0">{notifIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-semibold truncate flex-1">{n.title}</p>
                            <span className="shrink-0 w-2 h-2 rounded-full bg-orange-500" />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">
                            {n.date ? new Date(n.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Just now'}
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                <div className="p-3 bg-white/5 border-t border-white/10 text-center">
                  <Link
                    href="/parent/communication"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-bold text-slate-400 hover:text-orange-400 uppercase tracking-wider"
                  >
                    View All Communications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Profile ── */}
          <div ref={profileRef} className="relative flex items-center gap-3 border-l pl-6 border-white/10">
            <button
              onClick={() => { setShowProfile(p => !p); setShowNotifications(false); }}
              className="flex items-center gap-3 focus:outline-none"
              aria-label="Profile menu"
            >
              <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-black text-sm shadow-sm shrink-0">
                PS
              </div>
              <div className="text-sm hidden sm:block text-left">
                <p className="text-slate-400 text-xs">Welcome,</p>
                <p className="font-bold text-white">Priya Sharma</p>
              </div>
            </button>

            {showProfile && (
              <div className="absolute top-12 right-0 w-52 bg-slate-800 border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-white/5">
                  <p className="font-bold text-white text-sm">Priya Sharma</p>
                  <p className="text-xs text-slate-400 mt-0.5">Parent Account</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/parent/dashboard"
                    onClick={() => setShowProfile(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors"
                  >
                    <UserCircleIcon className="w-4 h-4 text-slate-400" />
                    Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

    </>
  );
}
