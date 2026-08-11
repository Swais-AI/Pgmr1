'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { fetchAssignmentsHistory, fetchAssignmentAnalytics, submitAssignment } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import AIInsightPanel from '@/components/AIInsightPanel';
import { useAIAssignmentReport } from '@/hooks/useAIAssignmentReport';
import { useTranslation, useTranslatedText } from '@/lib/multilingual';

type Assignment = {
  assignment_id: number; assignment_title: string; assignment_text?: string | null;
  subject: string; chapter_name?: string;
  teacher_name?: string; due_date: string; status: string;
  marks_obtained?: number | null; total_marks?: number | null;
  submitted_at?: string | null; submission_text?: string | null;
  teacher_remarks?: string | null; file_path?: string | null;
};
type Analytics = { total: number; submitted: number; pending: number; overdue: number; graded: number; completion_pct: number };

const S: Record<string, { bg: string; text: string; border: string }> = {
  Upcoming:  { bg: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE' },
  Ongoing:   { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' },
  Submitted: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  Graded:    { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
  Overdue:   { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
};

const TABS = ['All','Upcoming','Ongoing','Submitted','Graded','Overdue'] as const;
type Tab = typeof TABS[number];

const fmt = (d?: string|null) => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '–';

const daysTag = (due: string, status: string) => {
  if (!due || status==='Graded'||status==='Submitted') return null;
  const d = Math.ceil((new Date(due).getTime()-Date.now())/86400000);
  if (d<0) return {t:`${Math.abs(d)}d overdue`,c:'#DC2626'};
  if (d===0) return {t:'Due today',c:'#EA580C'};
  if (d===1) return {t:'Tomorrow',c:'#EA580C'};
  return {t:`${d} days left`,c:d<=7?'#EA580C':'#6B7280'};
};

const Badge = ({status}:{status:string}) => {
  const s = S[status]||{bg:'#F3F4F6',text:'#374151',border:'#D1D5DB'};
  return <span style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`}} className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg">{status}</span>;
};

export default function AssignmentsPage() {
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();
  const { status: aiStatus, report, errorType: aiErrorType, generate: generateReport } = useAIAssignmentReport(parentId);
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({total:0,submitted:0,pending:0,overdue:0,graded:0,completion_pct:0});
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [subj, setSubj] = useState('All');
  const [statusF, setStatusF] = useState('All');
  const [drawer, setDrawer] = useState<Assignment|null>(null);
  const [modal, setModal] = useState(false);
  const [target, setTarget] = useState<Assignment|null>(null);
  const [text, setText] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [driveLinkError, setDriveLinkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{m:string;ok:boolean}|null>(null);
  const [aiModal, setAiModal] = useState(false);

  const notify = (m:string,ok=true) => { setToast({m,ok}); setTimeout(()=>setToast(null),3000); };

  const validateGoogleDriveUrl = (url: string): boolean => {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return false; }
    if (parsed.protocol !== 'https:') return false;
    const ALLOWED_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return false;
    const p = parsed.pathname;
    const validPath =
      /^\/file\/d\/[^/]+/.test(p) ||
      /^\/drive\/folders\/[^/]+/.test(p) ||
      /^\/open$/.test(p) ||
      /^\/document\/d\/[^/]+/.test(p) ||
      /^\/spreadsheets\/d\/[^/]+/.test(p) ||
      /^\/presentation\/d\/[^/]+/.test(p);
    if (!validPath) return false;
    if (parsed.hostname === 'drive.google.com' && /^\/open$/.test(p)) {
      return !!parsed.searchParams.get('id');
    }
    return true;
  };

  const load = async () => {
    if (!studentId) return; // wait for real studentId
    setIsLoading(true);
    console.log('[SGS] Assignments: fetching for student_id', studentId);
    const [a,an] = await Promise.all([fetchAssignmentsHistory(studentId),fetchAssignmentAnalytics(studentId)]);
    setAssignments(a); setAnalytics(an); setIsLoading(false);
  };

  useEffect(()=>{ load(); setDrawer(null); setTab('All'); },[studentId]);

  const subjects = useMemo(()=>['All',...Array.from(new Set(assignments.map(a=>a.subject)))],[assignments]);

  const rows = useMemo(()=>assignments.filter(a=>{
    if(tab!=='All'&&a.status!==tab) return false;
    if(subj!=='All'&&a.subject!==subj) return false;
    if(statusF!=='All'&&a.status!==statusF) return false;
    if(search){const q=search.toLowerCase();if(!a.assignment_title.toLowerCase().includes(q)&&!a.subject.toLowerCase().includes(q)&&!(a.chapter_name||'').toLowerCase().includes(q))return false;}
    return true;
  }),[assignments,tab,subj,statusF,search]);

  const counts = useMemo(()=>TABS.reduce((acc,t)=>({...acc,[t]:t==='All'?assignments.length:assignments.filter(a=>a.status===t).length}),{} as Record<Tab,number>),[assignments]);

  // ── Translation: table rows (parallel arrays indexed by rows position) ──
  // Must be after `rows` useMemo to avoid temporal dead zone on the deps array.
  const rowTitleTexts   = useMemo(() => rows.map(a => a.assignment_title),   [rows]);
  const rowChapterTexts = useMemo(() => rows.map(a => a.chapter_name ?? ''),  [rows]);
  const rowSubjectTexts = useMemo(() => rows.map(a => a.subject),             [rows]);

  const { displayed: dispRowTitles   } = useTranslation(rowTitleTexts,   language);
  const { displayed: dispRowChapters } = useTranslation(rowChapterTexts, language);
  const { displayed: dispRowSubjects } = useTranslation(rowSubjectTexts, language);

  // ── Translation: open drawer (flat array, indexed 0-6) ────────────────
  // [0] title  [1] chapter  [2] subject  [3] description
  // [4] teacher_remarks  [5] submission_text  [6] teacher_name
  // `drawer` is useState so it is always initialised — no TDZ risk.
  const drawerTextArr = useMemo(() => drawer ? [
    drawer.assignment_title,
    drawer.chapter_name   ?? '',
    drawer.subject,
    drawer.assignment_text ?? '',
    drawer.teacher_remarks ?? '',
    drawer.submission_text ?? '',
    drawer.teacher_name   ?? '',
  ] : [], [drawer]);

  const { displayed: dD } = useTranslation(drawerTextArr, language);

  // ── Translation: submit modal target (flat array, indexed 0-2) ────────
  // [0] title  [1] subject  [2] teacher_name
  const targetTextArr = useMemo(() => target ? [
    target.assignment_title,
    target.subject,
    target.teacher_name ?? '',
  ] : [], [target]);

  const { displayed: dT } = useTranslation(targetTextArr, language);

  // ── Translation: AI report (single string, no English flash) ──────────
  const { displayed: translatedReport, translating: translatingReport } =
    useTranslatedText(report, language);
  const reportPanelStatus = aiStatus === 'success' && translatingReport ? 'loading' : aiStatus;

  const doSubmit = async () => {
    if(!text.trim()||!target) return;
    const trimmedLink = driveLink.trim();
    if (trimmedLink && !validateGoogleDriveUrl(trimmedLink)) {
      setDriveLinkError('Please enter a valid Google Drive link.');
      return;
    }
    setDriveLinkError('');
    setSubmitting(true);
    try {
      const payload: { assignment_id: number; student_id: number; submission_text: string; file_path?: string } = {
        assignment_id: target.assignment_id,
        student_id: studentId,
        submission_text: text,
      };
      if (trimmedLink) payload.file_path = trimmedLink;
      const up = await submitAssignment(payload);
      setAssignments(p=>p.map(a=>a.assignment_id===up.assignment_id?up:a));
      if(drawer?.assignment_id===up.assignment_id) setDrawer(up);
      await load(); setModal(false); setText(''); setDriveLink(''); setDriveLinkError(''); notify('Submitted successfully!');
    } catch { notify('Submission failed.',false); }
    finally { setSubmitting(false); }
  };

  const openModal = (a?:Assignment) => { setTarget(a||null); setText(''); setDriveLink(''); setDriveLinkError(''); setModal(true); };

  const cards = [
    {label:'Total',val:analytics.total,note:'All assignments',icon:'📋',c:'#6366F1'},
    {label:'Ongoing',val:analytics.pending,note:'Due within 7 days',icon:'⚡',c:'#0369A1'},
    {label:'Submitted',val:analytics.submitted+analytics.graded,note:`${analytics.completion_pct}% done`,icon:'✅',c:'#15803D'},
    {label:'Overdue',val:analytics.overdue,note:'Need attention',icon:'🚨',c:'#DC2626'},
    {label:'Graded',val:analytics.graded,note:'Marks received',icon:'🎯',c:'#D97706'},
  ];

  return (
    <div className="min-h-full flex flex-col font-sans">
      <TopBar studentId={studentId} setStudentId={setStudentId} parentId={parentId} language={language} setLanguage={setLanguage} isLoading={isLoading}/>

      {toast&&<div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.ok?'bg-green-600':'bg-red-600'}`}>{toast.m}</div>}

      <div className="flex-1 p-4 md:p-5">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black" style={{color:'#F8FAFC'}}>Assignments</h1>
              <p className="text-sm mt-0.5" style={{color:'#94A3B8'}}>Track, submit, and monitor all assignments.</p>
            </div>
            <div className="flex items-center gap-2">
              {aiStatus !== 'disabled' && (
                <button
                  onClick={() => { setAiModal(true); if (aiStatus === 'idle') generateReport(); }}
                  className="text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                  style={{background:'#7C3AED'}}
                >
                  ✨ AI Insights
                </button>
              )}
              <button onClick={()=>openModal()} className="text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2" style={{background:'#EA580C'}}>
                + New Submission
              </button>
            </div>
          </div>

          {isLoading?(
            <div className="flex justify-center items-center h-60"><div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{borderColor:'#EA580C'}}></div></div>
          ):(
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map(c=>(
                  <div key={c.label} className="bg-slate-800 rounded-xl border p-4" style={{borderColor:'rgba(255,255,255,0.1)'}}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{background:c.c+'18'}}>{c.icon}</div>
                      <span className="text-xs font-semibold" style={{color:'#94A3B8'}}>{c.label}</span>
                    </div>
                    <p className="text-2xl font-black" style={{color:'#F8FAFC'}}>{c.val}</p>
                    <p className="text-[11px] mt-0.5" style={{color:'#64748B'}}>{c.note}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="bg-slate-800 rounded-xl border p-3 flex flex-wrap gap-2.5 items-center" style={{borderColor:'rgba(255,255,255,0.1)'}}>
                <select value={subj} onChange={e=>setSubj(e.target.value)}
                  className="text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer"
                  style={{color:'#F8FAFC',borderColor:'rgba(255,255,255,0.1)',background:'#334155'}}>
                  {subjects.map(s=><option key={s} value={s} style={{background:'#334155',color:'#F8FAFC'}}>{s==='All'?'All Subjects':s}</option>)}
                </select>
                <select value={statusF} onChange={e=>setStatusF(e.target.value)}
                  className="text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer"
                  style={{color:'#F8FAFC',borderColor:'rgba(255,255,255,0.1)',background:'#334155'}}>
                  {['All','Upcoming','Ongoing','Submitted','Graded','Overdue'].map(s=><option key={s} value={s} style={{background:'#334155',color:'#F8FAFC'}}>{s==='All'?'All Status':s}</option>)}
                </select>
                <div className="flex-1 relative min-w-[200px]">
                  <span className="absolute left-3 top-2.5 text-base">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title, subject, chapter..."
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none placeholder:text-slate-400"
                    style={{color:'#F8FAFC',borderColor:'rgba(255,255,255,0.1)',background:'#334155'}}/>
                </div>
                {(search||subj!=='All'||statusF!=='All')&&(
                  <button onClick={()=>{setSearch('');setSubj('All');setStatusF('All');}} className="text-xs font-semibold" style={{color:'#EA580C'}}>Clear ×</button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b overflow-x-auto" style={{borderColor:'rgba(255,255,255,0.1)'}}>
                {TABS.map(t=>(
                  <button key={t} onClick={()=>setTab(t)} className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5"
                    style={{borderColor:tab===t?'#EA580C':'transparent',color:tab===t?'#EA580C':'#94A3B8'}}>
                    {t}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:tab===t?'rgba(234,88,12,0.15)':'rgba(255,255,255,0.08)',color:tab===t?'#EA580C':'#64748B'}}>
                      {counts[t]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="bg-slate-900 rounded-xl border overflow-hidden" style={{borderColor:'rgba(255,255,255,0.1)'}}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{background:'#1e293b',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                      <tr>
                        {['Assignment','Subject','Due Date','Submitted On','Marks','Status','Action'].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{color:'#94A3B8'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length===0?(
                        <tr><td colSpan={7} className="text-center py-14">
                          <div className="text-3xl mb-2">📭</div>
                          <p className="font-semibold" style={{color:'#CBD5E1'}}>No assignments found</p>
                          <p className="text-xs mt-1" style={{color:'#64748B'}}>Try adjusting your filters</p>
                        </td></tr>
                      ):rows.map((a,i)=>{
                        const dt=daysTag(a.due_date,a.status);
                        return(
                          <tr key={i} onClick={()=>setDrawer(a)}
                            className="transition-colors border-b cursor-pointer" style={{borderColor:'rgba(255,255,255,0.05)'}}
                            onMouseEnter={e=>(e.currentTarget.style.background='rgba(234,88,12,0.1)')}
                            onMouseLeave={e=>(e.currentTarget.style.background='')}>
                            <td className="px-4 py-3">
                              <p className="font-bold hover:text-orange-600 transition-colors" style={{color:'#F8FAFC'}}>{dispRowTitles[i] ?? a.assignment_title}</p>
                              <p className="text-xs mt-0.5" style={{color:'#64748B'}}>{dispRowChapters[i] ?? a.chapter_name}</p>
                            </td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap" style={{color:'#CBD5E1'}}>{dispRowSubjects[i] ?? a.subject}</td>
                            <td className="px-4 py-3">
                              <p className="whitespace-nowrap" style={{color:'#CBD5E1'}}>{fmt(a.due_date)}</p>
                              {dt&&<p className="text-[11px] font-semibold mt-0.5" style={{color:dt.c}}>{dt.t}</p>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" style={{color:'#94A3B8'}}>{a.submitted_at?fmt(a.submitted_at):'–'}</td>
                            <td className="px-4 py-3 font-bold whitespace-nowrap" style={{color:'#F8FAFC'}}>
                              {a.marks_obtained!=null?<>{a.marks_obtained}<span style={{color:'#64748B',fontWeight:400}}> /{a.total_marks||'–'}</span></>:'–'}
                            </td>
                            <td className="px-4 py-3"><Badge status={a.status}/></td>
                            <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                              <button onClick={()=>setDrawer(a)} className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors hover:border-orange-400 hover:text-orange-600" style={{color:'#E2E8F0',borderColor:'rgba(255,255,255,0.1)'}}>View</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t text-xs" style={{borderColor:'rgba(255,255,255,0.05)',color:'#64748B'}}>
                  Showing {rows.length} of {analytics.total} assignments
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ASSIGNMENT DETAILS MODAL (centered) ── */}
      {drawer&&(
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 md:pt-24" onClick={()=>setDrawer(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100]"/>
          <div className="relative bg-slate-800 border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full overflow-hidden z-[110]"
            style={{maxWidth:'820px', maxHeight:'85vh'}}
            onClick={e=>e.stopPropagation()}>

            {/* ── MODAL HEADER ── */}
            <div className="shrink-0 px-6 pt-7 pb-6 border-b sticky top-0 z-20" style={{background:'rgba(255,255,255,0.05)',borderColor:'rgba(255,255,255,0.1)'}}>
              <div className="flex items-start justify-between gap-4">
                {/* Left: title block */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-black break-words leading-tight" style={{color:'#F8FAFC'}}>{dD[0] ?? drawer.assignment_title}</h2>
                  {drawer.chapter_name&&(
                    <p className="text-sm mt-1.5 flex items-center gap-1.5" style={{color:'#94A3B8'}}>
                      <span>📖</span><span className="font-medium">{dD[1] ?? drawer.chapter_name}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2.5 mt-4">
                    <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{background:'rgba(234,88,12,0.15)',color:'#EA580C'}}>{dD[2] ?? drawer.subject}</span>
                    <Badge status={drawer.status}/>
                  </div>
                </div>
                {/* Right: close */}
                <button onClick={()=>setDrawer(null)}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-2xl hover:bg-white/10 transition-colors mt-0.5"
                  style={{color:'#94A3B8'}}>×</button>
              </div>
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* SECTION 1 — Description */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#64748B'}}>Description</p>
                  <div className="rounded-xl p-4" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
                    <p className="text-sm leading-relaxed" style={{color:drawer.assignment_text?'#E2E8F0':'#64748B',fontStyle:drawer.assignment_text?'normal':'italic'}}>
                      {drawer.assignment_text ? (dD[3] || drawer.assignment_text) : 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* SECTION 2 — Info Grid (2 cols × 3 rows) */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{color:'#64748B'}}>Assignment Information</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      {icon:'👤',l:'Teacher',         v:dD[6] || drawer.teacher_name||'–'},
                      {icon:'📅',l:'Due Date',         v:fmt(drawer.due_date)},
                      {icon:'📤',l:'Submitted On',     v:drawer.submitted_at?fmt(drawer.submitted_at):'Not submitted'},
                      {icon:'🎯',l:'Marks Obtained',   v:drawer.marks_obtained!=null?`${drawer.marks_obtained}`:'–'},
                      {icon:'📊',l:'Total Marks',      v:drawer.total_marks!=null?`${drawer.total_marks}`:'–'},
                      {icon:'📋',l:'Chapter',          v:dD[1] || drawer.chapter_name||'–'},
                    ].map(({icon,l,v})=>(
                      <div key={l} className="rounded-xl p-3.5" style={{background:'rgba(255,255,255,0.05)',border:'1px solid #E5E7EB'}}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{color:'#64748B'}}><span>{icon}</span>{l}</p>
                        <p className="text-sm font-bold" style={{color:'#F8FAFC'}}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 3 — Status Insight */}
                {(()=>{
                  const dt=daysTag(drawer.due_date,drawer.status);
                  type C={bg:string;bd:string;tx:string;icon:string;msg:string};
                  let c:C|null=null;
                  if(drawer.status==='Overdue')   c={bg:'#FEF2F2',bd:'#FECACA',tx:'#DC2626',icon:'⚠️',msg:dt?`Assignment overdue by ${dt.t.replace('d overdue','days')}.`:'Assignment is overdue.'};
                  else if(drawer.status==='Ongoing')   c={bg:'#EFF6FF',bd:'#BFDBFE',tx:'#1D4ED8',icon:'⏰',msg:dt?`Due in ${dt.t}.`:'Assignment is currently active.'};
                  else if(drawer.status==='Upcoming')  c={bg:'#F3E8FF',bd:'#D8B4FE',tx:'#7E22CE',icon:'📌',msg:dt?`Upcoming — ${dt.t}.`:'Assignment is upcoming.'};
                  else if(drawer.status==='Submitted') c={bg:'#EFF6FF',bd:'#BFDBFE',tx:'#1D4ED8',icon:'📩',msg:'Submission sent. Waiting for teacher evaluation.'};
                  else if(drawer.status==='Graded')    c={bg:'#F0FDF4',bd:'#BBF7D0',tx:'#15803D',icon:'✅',msg:'Assignment evaluated successfully.'};
                  return c?(
                    <div className="rounded-xl p-4 flex items-center gap-3" style={{background:c.bg,border:`1px solid ${c.bd}`}}>
                      <span className="text-xl shrink-0">{c.icon}</span>
                      <p className="text-sm font-semibold" style={{color:c.tx}}>{c.msg}</p>
                    </div>
                  ):null;
                })()}

                {/* SECTION 4 — Teacher Remarks */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#64748B'}}>Teacher Remarks</p>
                  {drawer.teacher_remarks?(
                    <div className="rounded-xl p-4" style={{background:'#EFF6FF',border:'1px solid #BFDBFE'}}>
                      <p className="text-[10px] font-bold uppercase mb-1.5 flex items-center gap-1.5" style={{color:'#1D4ED8'}}>
                        <span>💬</span>Feedback from {dD[6] || drawer.teacher_name||'Teacher'}
                      </p>
                      <p className="text-sm leading-relaxed" style={{color:'#1E40AF'}}>"{dD[4] || drawer.teacher_remarks}"</p>
                    </div>
                  ):(
                    <p className="text-sm italic py-1" style={{color:'#64748B'}}>No remarks added yet.</p>
                  )}
                </div>

                {/* SECTION 5 — Student Submission */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#64748B'}}>Student Submission</p>
                  {drawer.submission_text?(
                    <div className="space-y-2.5">
                      <div className="rounded-xl p-4" style={{background:'#F0FDF4',border:'1px solid #BBF7D0'}}>
                        <p className="text-[10px] font-bold uppercase mb-2 flex items-center gap-1.5" style={{color:'#15803D'}}><span>📝</span>Submitted Answer</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{color:'#166534'}}>{dD[5] || drawer.submission_text}</p>
                        {drawer.submitted_at&&(
                          <p className="text-[11px] mt-2 pt-2 border-t" style={{color:'#86EFAC',borderColor:'#BBF7D0'}}>Submitted on {fmt(drawer.submitted_at)}</p>
                        )}
                      </div>
                      {drawer.file_path&&(
                        <div className="rounded-xl p-3 flex items-center gap-3" style={{background:'rgba(255,255,255,0.05)',border:'1px solid #E5E7EB'}}>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{background:'rgba(255,255,255,0.08)'}}>📎</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold" style={{color:'#E2E8F0'}}>Attachment</p>
                            <p className="text-xs truncate" style={{color:'#94A3B8'}}>{drawer.file_path}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ):(
                    <div className="rounded-xl p-5 text-center" style={{background:'rgba(255,255,255,0.05)',border:'1px dashed #E5E7EB'}}>
                      <p className="text-2xl mb-1">📭</p>
                      <p className="text-sm font-semibold" style={{color:'#94A3B8'}}>No submission uploaded yet.</p>
                      <p className="text-xs mt-0.5" style={{color:'#64748B'}}>Click the button below to submit.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ── STICKY FOOTER ── */}
            <div className="shrink-0 px-6 py-4 border-t flex flex-wrap gap-3" style={{borderColor:'rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)'}}>
              {['Upcoming','Ongoing','Overdue'].includes(drawer.status)?(
                <button onClick={()=>{setTarget(drawer);openModal(drawer);setDrawer(null);}}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-90 transition-opacity"
                  style={{background:'#EA580C'}}>Submit Assignment</button>
              ):drawer.status==='Submitted'?(
                <button onClick={()=>{setTarget(drawer);openModal(drawer);setDrawer(null);}}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border hover:border-orange-400 hover:text-orange-600 transition-colors"
                  style={{color:'#CBD5E1',borderColor:'rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)'}}>Update Submission</button>
              ):drawer.status==='Graded'?(
                <div className="flex-1 rounded-xl py-2.5 text-center" style={{background:'#F0FDF4',border:'1px solid #BBF7D0'}}>
                  <p className="text-sm font-bold" style={{color:'#15803D'}}>✅ Graded — {drawer.marks_obtained} marks received</p>
                </div>
              ):null}
              <button
                onClick={()=>{
                  const subject = encodeURIComponent(`Re: ${drawer.assignment_title} (${drawer.subject})`);
                  router.push(`/parent/communication?new=1&subject=${subject}&category=Academic`);
                  setDrawer(null);
                }}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:border-blue-400 hover:text-blue-600 flex items-center gap-1.5"
                style={{color:'#1D4ED8',borderColor:'#BFDBFE',background:'#EFF6FF'}}>
                💬 Ask Teacher
              </button>
              <button onClick={()=>setDrawer(null)}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/10"
                style={{color:'#94A3B8',borderColor:'rgba(255,255,255,0.1)'}}>Close</button>
            </div>
          </div>
        </div>
      )}


      {/* Submit Modal */}

      {modal&&(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100]"/>
          <div className="relative bg-slate-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-[110]">
            <div className="p-5 border-b flex justify-between items-center" style={{borderColor:'rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)'}}>
              <h3 className="font-black text-lg" style={{color:'#F8FAFC'}}>Submit Assignment</h3>
              <button onClick={()=>{setModal(false);setText('');}} className="text-2xl leading-none hover:opacity-60" style={{color:'#64748B'}}>×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Assignment selector */}
              {!target?(
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{color:'#E2E8F0'}}>Select Assignment</label>
                  <select onChange={e=>{const f=assignments.find(a=>a.assignment_id===Number(e.target.value));setTarget(f||null);}}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
                    style={{color:'#F8FAFC',borderColor:'rgba(255,255,255,0.1)',background:'#1e293b'}}>
                    <option value="" style={{background:'#1e293b',color:'#94A3B8'}}>— Choose an assignment —</option>
                    {assignments.filter(a=>['Upcoming','Ongoing','Overdue'].includes(a.status)).map(a=>(
                      <option key={a.assignment_id} value={a.assignment_id} style={{background:'#1e293b',color:'#F8FAFC'}}>
                        {a.assignment_title} · {a.subject} · Due {fmt(a.due_date)}
                      </option>
                    ))}
                  </select>
                </div>
              ):(
                <div className="rounded-xl p-4" style={{background:'rgba(234,88,12,0.1)',border:'1px solid rgba(234,88,12,0.25)'}}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{color:'#EA580C'}}>Submitting for</p>
                      <p className="font-bold mt-0.5" style={{color:'#F8FAFC'}}>{dT[0] ?? target.assignment_title}</p>
                      <p className="text-xs mt-0.5" style={{color:'#94A3B8'}}>{dT[1] ?? target.subject} · Due {fmt(target.due_date)}</p>
                      {target.teacher_name&&<p className="text-xs mt-0.5" style={{color:'#94A3B8'}}>Teacher: {dT[2] ?? target.teacher_name}</p>}
                    </div>
                    <button onClick={()=>setTarget(null)} className="text-xs font-bold" style={{color:'#EA580C'}}>Change</button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{color:'#E2E8F0'}}>
                  Submission Text <span style={{color:'#DC2626'}}>*</span>
                </label>
                <textarea rows={5} value={text} onChange={e=>setText(e.target.value)}
                  placeholder="Write your answer or describe your submission..."
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none bg-slate-700 placeholder:text-slate-500"
                  style={{color:'#F8FAFC',borderColor:'rgba(255,255,255,0.1)',lineHeight:'1.6'}}
                  onFocus={e=>e.target.style.borderColor='#EA580C'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{color:'#E2E8F0'}}>Google Drive Link <span style={{color:'#94A3B8',fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
                <div className="border-2 border-dashed rounded-xl p-4" style={{borderColor:'rgba(255,255,255,0.1)'}}>
                  <p className="text-xs mb-2" style={{color:'#64748B'}}>📎 Paste a Google Drive or Google Docs link</p>
                  <input
                    type="text"
                    value={driveLink}
                    onChange={e => { setDriveLink(e.target.value); setDriveLinkError(''); }}
                    placeholder="https://drive.google.com/..."
                    className="w-full text-sm border rounded-lg px-3 py-2 outline-none bg-slate-700 placeholder:text-slate-500"
                    style={{color:'#F8FAFC',borderColor:driveLinkError?'#DC2626':'rgba(255,255,255,0.1)'}}
                    onFocus={e=>e.target.style.borderColor=driveLinkError?'#DC2626':'#EA580C'}
                    onBlur={e=>e.target.style.borderColor=driveLinkError?'#DC2626':'rgba(255,255,255,0.1)'}
                  />
                  {driveLinkError && (
                    <p className="flex items-center gap-1 text-xs font-semibold mt-1.5" style={{color:'#F87171'}}>
                      <span>⚠️</span> {driveLinkError}
                    </p>
                  )}
                  {!driveLinkError && <p className="text-[10px] mt-1.5" style={{color:'#475569'}}>Accepted: drive.google.com · docs.google.com (HTTPS only)</p>}
                </div>
              </div>

              <button onClick={doSubmit} disabled={!text.trim()||!target||submitting}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity"
                style={{background:(!text.trim()||!target||submitting)?'#FED7AA':'#EA580C',cursor:(!text.trim()||!target||submitting)?'not-allowed':'pointer'}}>
                {submitting?'Submitting…':'Submit Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Modal */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.45)'}}>
          <div className="bg-slate-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{maxHeight:'85vh'}}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:'rgba(255,255,255,0.1)'}}>
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h2 className="text-base font-bold" style={{color:'#F8FAFC'}}>AI Assignment Insights</h2>
              </div>
              <button
                onClick={() => setAiModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-xl font-bold leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <AIInsightPanel
                status={reportPanelStatus} analysis={translatedReport} errorType={aiErrorType}
                onGenerate={generateReport} buttonLabel="Generate AI Report"
                insightLabel="AI Assignment Summary"
              />
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t flex justify-end" style={{borderColor:'rgba(255,255,255,0.1)'}}>
              <button
                onClick={() => setAiModal(false)}
                className="px-5 py-2 rounded-xl text-sm font-bold border transition-colors"
                style={{color:'#E2E8F0', borderColor:'rgba(255,255,255,0.1)'}}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
