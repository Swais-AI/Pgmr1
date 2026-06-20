'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { fetchAssignmentsHistory, fetchAssignmentAnalytics, submitAssignment } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';

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
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{m:string;ok:boolean}|null>(null);

  const notify = (m:string,ok=true) => { setToast({m,ok}); setTimeout(()=>setToast(null),3000); };

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

  const doSubmit = async () => {
    if(!text.trim()||!target) return;
    setSubmitting(true);
    try {
      const up = await submitAssignment({assignment_id:target.assignment_id,student_id:studentId,submission_text:text});
      setAssignments(p=>p.map(a=>a.assignment_id===up.assignment_id?up:a));
      if(drawer?.assignment_id===up.assignment_id) setDrawer(up);
      await load(); setModal(false); setText(''); notify('Submitted successfully!');
    } catch { notify('Submission failed.',false); }
    finally { setSubmitting(false); }
  };

  const openModal = (a?:Assignment) => { setTarget(a||null); setText(''); setModal(true); };

  const cards = [
    {label:'Total',val:analytics.total,note:'All assignments',icon:'📋',c:'#6366F1'},
    {label:'Ongoing',val:analytics.pending,note:'Due within 7 days',icon:'⚡',c:'#0369A1'},
    {label:'Submitted',val:analytics.submitted+analytics.graded,note:`${analytics.completion_pct}% done`,icon:'✅',c:'#15803D'},
    {label:'Overdue',val:analytics.overdue,note:'Need attention',icon:'🚨',c:'#DC2626'},
    {label:'Graded',val:analytics.graded,note:'Marks received',icon:'🎯',c:'#D97706'},
  ];

  return (
    <div className="min-h-full flex flex-col font-sans" style={{background:'#F9FAFB'}}>
      <TopBar studentId={studentId} setStudentId={setStudentId} parentId={parentId} language={language} setLanguage={setLanguage} isLoading={isLoading}/>

      {toast&&<div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.ok?'bg-green-600':'bg-red-600'}`}>{toast.m}</div>}

      <div className="flex-1 p-4 md:p-5">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black" style={{color:'#111827'}}>Assignments</h1>
              <p className="text-sm mt-0.5" style={{color:'#6B7280'}}>Track, submit, and monitor all assignments.</p>
            </div>
            <button onClick={()=>openModal()} className="text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2" style={{background:'#EA580C'}}>
              + New Submission
            </button>
          </div>

          {isLoading?(
            <div className="flex justify-center items-center h-60"><div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{borderColor:'#EA580C'}}></div></div>
          ):(
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map(c=>(
                  <div key={c.label} className="bg-white rounded-xl border p-4 shadow-sm" style={{borderColor:'#E5E7EB'}}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{background:c.c+'18'}}>{c.icon}</div>
                      <span className="text-xs font-semibold" style={{color:'#6B7280'}}>{c.label}</span>
                    </div>
                    <p className="text-2xl font-black" style={{color:'#111827'}}>{c.val}</p>
                    <p className="text-[11px] mt-0.5" style={{color:'#9CA3AF'}}>{c.note}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border shadow-sm p-3 flex flex-wrap gap-2.5 items-center" style={{borderColor:'#E5E7EB'}}>
                <select value={subj} onChange={e=>setSubj(e.target.value)}
                  className="text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer"
                  style={{color:'#111827',borderColor:'#D1D5DB',background:'#FFFFFF'}}>
                  {subjects.map(s=><option key={s} value={s} style={{color:'#111827'}}>{s==='All'?'All Subjects':s}</option>)}
                </select>
                <select value={statusF} onChange={e=>setStatusF(e.target.value)}
                  className="text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer"
                  style={{color:'#111827',borderColor:'#D1D5DB',background:'#FFFFFF'}}>
                  {['All','Upcoming','Ongoing','Submitted','Graded','Overdue'].map(s=><option key={s} value={s} style={{color:'#111827'}}>{s==='All'?'All Status':s}</option>)}
                </select>
                <div className="flex-1 relative min-w-[200px]">
                  <span className="absolute left-3 top-2.5 text-base">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title, subject, chapter..."
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none"
                    style={{color:'#111827',borderColor:'#D1D5DB',background:'#FFFFFF'}}/>
                </div>
                {(search||subj!=='All'||statusF!=='All')&&(
                  <button onClick={()=>{setSearch('');setSubj('All');setStatusF('All');}} className="text-xs font-semibold" style={{color:'#EA580C'}}>Clear ×</button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b overflow-x-auto" style={{borderColor:'#E5E7EB'}}>
                {TABS.map(t=>(
                  <button key={t} onClick={()=>setTab(t)} className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5"
                    style={{borderColor:tab===t?'#EA580C':'transparent',color:tab===t?'#EA580C':'#6B7280'}}>
                    {t}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:tab===t?'#FFF7ED':'#F3F4F6',color:tab===t?'#EA580C':'#9CA3AF'}}>
                      {counts[t]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{borderColor:'#E5E7EB'}}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{background:'#F9FAFB',borderBottom:'1px solid #E5E7EB'}}>
                      <tr>
                        {['Assignment','Subject','Due Date','Submitted On','Marks','Status','Action'].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{color:'#9CA3AF'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length===0?(
                        <tr><td colSpan={7} className="text-center py-14">
                          <div className="text-3xl mb-2">📭</div>
                          <p className="font-semibold" style={{color:'#4B5563'}}>No assignments found</p>
                          <p className="text-xs mt-1" style={{color:'#9CA3AF'}}>Try adjusting your filters</p>
                        </td></tr>
                      ):rows.map((a,i)=>{
                        const dt=daysTag(a.due_date,a.status);
                        return(
                          <tr key={i} onClick={()=>setDrawer(a)}
                            className="transition-colors border-b cursor-pointer" style={{borderColor:'#F3F4F6'}}
                            onMouseEnter={e=>(e.currentTarget.style.background='#FFF7ED')}
                            onMouseLeave={e=>(e.currentTarget.style.background='')}>
                            <td className="px-4 py-3">
                              <p className="font-bold hover:text-orange-600 transition-colors" style={{color:'#111827'}}>{a.assignment_title}</p>
                              <p className="text-xs mt-0.5" style={{color:'#9CA3AF'}}>{a.chapter_name}</p>
                            </td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap" style={{color:'#4B5563'}}>{a.subject}</td>
                            <td className="px-4 py-3">
                              <p className="whitespace-nowrap" style={{color:'#4B5563'}}>{fmt(a.due_date)}</p>
                              {dt&&<p className="text-[11px] font-semibold mt-0.5" style={{color:dt.c}}>{dt.t}</p>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" style={{color:'#6B7280'}}>{a.submitted_at?fmt(a.submitted_at):'–'}</td>
                            <td className="px-4 py-3 font-bold whitespace-nowrap" style={{color:'#111827'}}>
                              {a.marks_obtained!=null?<>{a.marks_obtained}<span style={{color:'#9CA3AF',fontWeight:400}}> /{a.total_marks||'–'}</span></>:'–'}
                            </td>
                            <td className="px-4 py-3"><Badge status={a.status}/></td>
                            <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                              <button onClick={()=>setDrawer(a)} className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors hover:border-orange-400 hover:text-orange-600" style={{color:'#374151',borderColor:'#D1D5DB'}}>View</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t text-xs" style={{borderColor:'#F3F4F6',color:'#9CA3AF'}}>
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
          <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full overflow-hidden z-[110]"
            style={{maxWidth:'820px', maxHeight:'85vh'}}
            onClick={e=>e.stopPropagation()}>

            {/* ── MODAL HEADER ── */}
            <div className="shrink-0 px-6 pt-7 pb-6 border-b sticky top-0 z-20" style={{background:'#F9FAFB',borderColor:'#E5E7EB'}}>
              <div className="flex items-start justify-between gap-4">
                {/* Left: title block */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-black break-words leading-tight" style={{color:'#111827'}}>{drawer.assignment_title}</h2>
                  {drawer.chapter_name&&(
                    <p className="text-sm mt-1.5 flex items-center gap-1.5" style={{color:'#6B7280'}}>
                      <span>📖</span><span className="font-medium">{drawer.chapter_name}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2.5 mt-4">
                    <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{background:'#FFF7ED',color:'#EA580C'}}>{drawer.subject}</span>
                    <Badge status={drawer.status}/>
                  </div>
                </div>
                {/* Right: close */}
                <button onClick={()=>setDrawer(null)}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-2xl hover:bg-gray-200 transition-colors mt-0.5"
                  style={{color:'#6B7280'}}>×</button>
              </div>
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* SECTION 1 — Description */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#9CA3AF'}}>Description</p>
                  <div className="rounded-xl p-4" style={{background:'#F9FAFB',border:'1px solid #E5E7EB'}}>
                    <p className="text-sm leading-relaxed" style={{color:drawer.assignment_text?'#374151':'#9CA3AF',fontStyle:drawer.assignment_text?'normal':'italic'}}>
                      {drawer.assignment_text||'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* SECTION 2 — Info Grid (2 cols × 3 rows) */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{color:'#9CA3AF'}}>Assignment Information</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      {icon:'👤',l:'Teacher',         v:drawer.teacher_name||'–'},
                      {icon:'📅',l:'Due Date',         v:fmt(drawer.due_date)},
                      {icon:'📤',l:'Submitted On',     v:drawer.submitted_at?fmt(drawer.submitted_at):'Not submitted'},
                      {icon:'🎯',l:'Marks Obtained',   v:drawer.marks_obtained!=null?`${drawer.marks_obtained}`:'–'},
                      {icon:'📊',l:'Total Marks',      v:drawer.total_marks!=null?`${drawer.total_marks}`:'–'},
                      {icon:'📋',l:'Chapter',          v:drawer.chapter_name||'–'},
                    ].map(({icon,l,v})=>(
                      <div key={l} className="rounded-xl p-3.5" style={{background:'#fff',border:'1px solid #E5E7EB'}}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{color:'#9CA3AF'}}><span>{icon}</span>{l}</p>
                        <p className="text-sm font-bold" style={{color:'#111827'}}>{v}</p>
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
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#9CA3AF'}}>Teacher Remarks</p>
                  {drawer.teacher_remarks?(
                    <div className="rounded-xl p-4" style={{background:'#EFF6FF',border:'1px solid #BFDBFE'}}>
                      <p className="text-[10px] font-bold uppercase mb-1.5 flex items-center gap-1.5" style={{color:'#1D4ED8'}}>
                        <span>💬</span>Feedback from {drawer.teacher_name||'Teacher'}
                      </p>
                      <p className="text-sm leading-relaxed" style={{color:'#1E40AF'}}>"{drawer.teacher_remarks}"</p>
                    </div>
                  ):(
                    <p className="text-sm italic py-1" style={{color:'#9CA3AF'}}>No remarks added yet.</p>
                  )}
                </div>

                {/* SECTION 5 — Student Submission */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#9CA3AF'}}>Student Submission</p>
                  {drawer.submission_text?(
                    <div className="space-y-2.5">
                      <div className="rounded-xl p-4" style={{background:'#F0FDF4',border:'1px solid #BBF7D0'}}>
                        <p className="text-[10px] font-bold uppercase mb-2 flex items-center gap-1.5" style={{color:'#15803D'}}><span>📝</span>Submitted Answer</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{color:'#166534'}}>{drawer.submission_text}</p>
                        {drawer.submitted_at&&(
                          <p className="text-[11px] mt-2 pt-2 border-t" style={{color:'#86EFAC',borderColor:'#BBF7D0'}}>Submitted on {fmt(drawer.submitted_at)}</p>
                        )}
                      </div>
                      {drawer.file_path&&(
                        <div className="rounded-xl p-3 flex items-center gap-3" style={{background:'#F9FAFB',border:'1px solid #E5E7EB'}}>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{background:'#F3F4F6'}}>📎</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold" style={{color:'#374151'}}>Attachment</p>
                            <p className="text-xs truncate" style={{color:'#6B7280'}}>{drawer.file_path}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ):(
                    <div className="rounded-xl p-5 text-center" style={{background:'#F9FAFB',border:'1px dashed #E5E7EB'}}>
                      <p className="text-2xl mb-1">📭</p>
                      <p className="text-sm font-semibold" style={{color:'#6B7280'}}>No submission uploaded yet.</p>
                      <p className="text-xs mt-0.5" style={{color:'#9CA3AF'}}>Click the button below to submit.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ── STICKY FOOTER ── */}
            <div className="shrink-0 px-6 py-4 border-t flex flex-wrap gap-3" style={{borderColor:'#E5E7EB',background:'#FAFAFA'}}>
              {['Upcoming','Ongoing','Overdue'].includes(drawer.status)?(
                <button onClick={()=>{setTarget(drawer);openModal(drawer);setDrawer(null);}}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-90 transition-opacity"
                  style={{background:'#EA580C'}}>Submit Assignment</button>
              ):drawer.status==='Submitted'?(
                <button onClick={()=>{setTarget(drawer);openModal(drawer);setDrawer(null);}}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border hover:border-orange-400 hover:text-orange-600 transition-colors"
                  style={{color:'#4B5563',borderColor:'#D1D5DB',background:'#fff'}}>Update Submission</button>
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
                className="px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-gray-50"
                style={{color:'#6B7280',borderColor:'#E5E7EB'}}>Close</button>
            </div>
          </div>
        </div>
      )}


      {/* Submit Modal */}

      {modal&&(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100]"/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-[110]">
            <div className="p-5 border-b flex justify-between items-center" style={{borderColor:'#E5E7EB',background:'#F9FAFB'}}>
              <h3 className="font-black text-lg" style={{color:'#111827'}}>Submit Assignment</h3>
              <button onClick={()=>{setModal(false);setText('');}} className="text-2xl leading-none hover:opacity-60" style={{color:'#9CA3AF'}}>×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Assignment selector */}
              {!target?(
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{color:'#374151'}}>Select Assignment</label>
                  <select onChange={e=>{const f=assignments.find(a=>a.assignment_id===Number(e.target.value));setTarget(f||null);}}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
                    style={{color:'#111827',borderColor:'#D1D5DB',background:'#FFFFFF'}}>
                    <option value="" style={{color:'#9CA3AF'}}>— Choose an assignment —</option>
                    {assignments.filter(a=>['Upcoming','Ongoing','Overdue'].includes(a.status)).map(a=>(
                      <option key={a.assignment_id} value={a.assignment_id} style={{color:'#111827'}}>
                        {a.assignment_title} · {a.subject} · Due {fmt(a.due_date)}
                      </option>
                    ))}
                  </select>
                </div>
              ):(
                <div className="rounded-xl p-4" style={{background:'#FFF7ED',border:'1px solid #FED7AA'}}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{color:'#EA580C'}}>Submitting for</p>
                      <p className="font-bold mt-0.5" style={{color:'#111827'}}>{target.assignment_title}</p>
                      <p className="text-xs mt-0.5" style={{color:'#6B7280'}}>{target.subject} · Due {fmt(target.due_date)}</p>
                      {target.teacher_name&&<p className="text-xs mt-0.5" style={{color:'#6B7280'}}>Teacher: {target.teacher_name}</p>}
                    </div>
                    <button onClick={()=>setTarget(null)} className="text-xs font-bold" style={{color:'#EA580C'}}>Change</button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{color:'#374151'}}>
                  Submission Text <span style={{color:'#DC2626'}}>*</span>
                </label>
                <textarea rows={5} value={text} onChange={e=>setText(e.target.value)}
                  placeholder="Write your answer or describe your submission..."
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none"
                  style={{color:'#111827',borderColor:'#D1D5DB',lineHeight:'1.6'}}
                  onFocus={e=>e.target.style.borderColor='#EA580C'}
                  onBlur={e=>e.target.style.borderColor='#D1D5DB'}/>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{color:'#374151'}}>Attachment (optional)</label>
                <div className="border-2 border-dashed rounded-xl p-4 text-center" style={{borderColor:'#E5E7EB'}}>
                  <p className="text-sm" style={{color:'#9CA3AF'}}>📎 Drag & drop or paste a file link</p>
                  <input type="text" placeholder="https://drive.google.com/..." className="mt-2 w-full text-sm border rounded-lg px-3 py-2 outline-none"
                    style={{color:'#111827',borderColor:'#E5E7EB'}}/>
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
    </div>
  );
}
