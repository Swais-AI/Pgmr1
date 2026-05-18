// ════════════════════════════════════════════════════════════════════════════
// DISABLED COMPONENT — AttendanceHeatWidget
//
// Attendance module has been fully removed from the parent portal.
// This component is NOT imported by any active page or component.
// The /parent/attendance route now redirects to /parent/dashboard.
// Dashboard uses a "Learning Progress" StatCard derived from assignments/quizzes.
//
// Do NOT import this component. Kept for reference / rollback only.
// To restore: re-enable attendance module, re-add to dashboard, update sidebar.
// ════════════════════════════════════════════════════════════════════════════
'use client';
import React from 'react';
import Link from 'next/link';
import { CalendarDaysIcon } from '@heroicons/react/24/solid';

interface AttendanceHeatWidgetProps {
  heat: string;
  percentage?: number;
}

export default function AttendanceHeatWidget({ heat, percentage }: AttendanceHeatWidgetProps) {
  if (!heat) return null;

  const getHeatStyle = (status: string) => {
    switch (status) {
      case 'GOOD': return { icon: 'text-green-500', bg: 'bg-green-50', pct: 'text-green-600', badge: 'bg-green-100 text-green-700' };
      case 'WARNING': return { icon: 'text-yellow-600', bg: 'bg-yellow-50', pct: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700' };
      case 'CRITICAL': return { icon: 'text-red-500', bg: 'bg-red-50', pct: 'text-red-600', badge: 'bg-red-100 text-red-700' };
      default: return { icon: 'text-gray-500', bg: 'bg-gray-50', pct: 'text-gray-600', badge: 'bg-gray-100 text-gray-600' };
    }
  };

  const style = getHeatStyle(heat);
  const displayPct = percentage != null ? `${percentage}%` : heat === 'GOOD' ? '92%' : heat === 'WARNING' ? '78%' : '65%';

  return (
    <Link href="/parent/attendance" className="block">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col justify-center items-center text-center hover:border-orange-200 hover:shadow-md transition-all cursor-pointer">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 ${style.bg}`}>
          <CalendarDaysIcon className={`w-5 h-5 ${style.icon}`} />
        </div>
        <p className={`text-2xl font-black ${style.pct}`}>{displayPct}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">Attendance</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${style.badge}`}>{heat}</span>
        <span className="text-[10px] text-orange-500 font-semibold mt-1">View Details →</span>
      </div>
    </Link>
  );
}
