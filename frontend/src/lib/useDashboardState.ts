import { useState, useEffect } from 'react';
import { fetchMe, getSessionToken, setSessionToken, PARENT_NAME_KEY, SESSION_EVENT } from './api';

/**
 * Persistent dashboard state backed by localStorage.
 *
 * studentId and parentId default to 0 (meaning "not yet loaded / not set").
 * Pages should guard API calls with `if (!studentId) return;` to avoid
 * firing requests with an invalid ID before localStorage is read or before
 * ChildSelector has auto-selected the first real child.
 *
 * Who the parent is:
 *   The login portal redirects here with `?token=<signed jwt>`. On mount we
 *   store that token, strip it from the URL, and ask the backend (/auth/me)
 *   who it belongs to. parentId comes from that answer — never from anything
 *   the browser could have typed in.
 *
 *   With no token at all the dashboard cannot know who it is serving:
 *     - in development it falls back to parent_id=10, the seeded demo parent,
 *       so the app still loads with real data on a laptop;
 *     - anywhere else it sends the user to the login portal.
 *   A token that fails verification clears the session but does not redirect,
 *   so a misconfigured backend cannot bounce users in a loop.
 */

const DEMO_PARENT_ID = 10;
const IS_DEV = process.env.NODE_ENV === 'development';

/** Pull `?token=` out of the address bar, if the login portal put one there. */
function takeTokenFromUrl(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  if (!token) return null;
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
  return token;
}

/** Persist the parent's display name and tell listeners (TopBar) it changed. */
function publishParent(parentId: number, parentName: string | null) {
  if (parentName) localStorage.setItem(PARENT_NAME_KEY, parentName);
  else localStorage.removeItem(PARENT_NAME_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { parentId, parentName } }));
}

function redirectToLogin() {
  const sgsUrl = process.env.NEXT_PUBLIC_SGS_URL;
  if (!sgsUrl) {
    console.error('[SGS] No session and NEXT_PUBLIC_SGS_URL is not configured — cannot redirect to login.');
    return;
  }
  window.location.replace(sgsUrl);
}

export function useDashboardState() {
  const [mounted,   setMounted]   = useState(false);
  const [studentId, setStudentId] = useState<number>(0); // 0 = not set yet
  const [parentId,  setParentId]  = useState<number>(0); // 0 = not set yet
  const [parentName, setParentName] = useState<string | null>(null);
  const [language,  setLanguage]  = useState<string>('en');

  useEffect(() => {
    const savedStudent = localStorage.getItem('sgs_student_id');
    const savedLang    = localStorage.getItem('sgs_language');
    const savedName    = localStorage.getItem(PARENT_NAME_KEY);
    if (savedLang) setLanguage(savedLang);
    if (savedName) setParentName(savedName);

    const handed = takeTokenFromUrl();
    if (handed) {
      setSessionToken(handed);
      // A fresh login means a possibly different parent: drop the old child
      // selection so ChildSelector picks from the right family.
      localStorage.removeItem('sgs_student_id');
      localStorage.removeItem('sgs_parent_id');
      localStorage.removeItem(PARENT_NAME_KEY);
      setParentName(null);
    }

    const token = handed ?? getSessionToken();

    // A remembered child selection is only meaningful inside a session. With
    // no token, leave studentId at 0 so nothing is fetched — otherwise a
    // stale sgs_student_id from an earlier visit would show that child's data
    // to whoever opens the page next.
    if (token && !handed && savedStudent) {
      const sid = Number(savedStudent);
      if (sid > 0) setStudentId(sid);
    }

    if (!token) {
      localStorage.removeItem('sgs_student_id');
      localStorage.removeItem('sgs_parent_id');
      if (IS_DEV) {
        console.warn('[SGS] No session token — using demo parent', DEMO_PARENT_ID, '(development only)');
        setParentId(DEMO_PARENT_ID);
        setMounted(true);
      } else {
        redirectToLogin();
      }
      return;
    }

    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setParentId(me.parent_id);
        setParentName(me.full_name);
        localStorage.setItem('sgs_parent_id', String(me.parent_id));
        publishParent(me.parent_id, me.full_name);
        console.log('[SGS] session → parent_id:', me.parent_id, me.full_name ?? '');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[SGS] Session token rejected; clearing it.', err?.response?.status ?? err?.message);
        setSessionToken(null);
        localStorage.removeItem('sgs_parent_id');
        setParentName(null);
        publishParent(0, null);
        if (IS_DEV) setParentId(DEMO_PARENT_ID);
        // Not redirecting on purpose: if the backend is misconfigured, a redirect
        // here would loop login → dashboard → login. Pages guard on parentId=0.
      })
      .finally(() => { if (!cancelled) setMounted(true); });

    return () => { cancelled = true; };
  }, []);

  const updateStudentId = (id: number) => {
    setStudentId(id);
    localStorage.setItem('sgs_student_id', id.toString());
    console.log('[SGS] studentId updated →', id);
  };

  const updateParentId = (id: number) => {
    setParentId(id);
    localStorage.setItem('sgs_parent_id', id.toString());
    console.log('[SGS] parentId updated →', id);
  };

  const updateLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('sgs_language', lang);
  };

  /** Forget the session. Call on logout before redirecting to the portal. */
  const clearSession = () => {
    setSessionToken(null);
    localStorage.removeItem('sgs_parent_id');
    localStorage.removeItem('sgs_student_id');
    setParentId(0);
    setStudentId(0);
    setParentName(null);
    publishParent(0, null);
  };

  return {
    mounted,
    studentId,
    setStudentId: updateStudentId,
    parentId,
    setParentId: updateParentId,
    parentName,
    language,
    setLanguage: updateLanguage,
    clearSession,
  };
}
