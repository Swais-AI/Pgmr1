// ════════════════════════════════════════════════════════════════════════════
// DISABLED COMPONENT — AttendanceTrendWidget
//
// Attendance module has been fully removed from the parent portal.
// This component is NOT imported by any active page or component.
// The backend no longer returns populated attendance_trend data.
//
// Do NOT import this component. Kept for reference / rollback only.
// To restore: re-enable attendance module and re-wire backend attendance_trend.
// ════════════════════════════════════════════════════════════════════════════
'use client';

export default function AttendanceTrendWidget({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">📅</span> Attendance Trend
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${parseInt(data.percentage) >= 90 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {data.percentage}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-gray-100 h-3 rounded-full overflow-hidden">
          <div className={`h-full ${parseInt(data.percentage) >= 90 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: data.percentage }}></div>
        </div>
        <span className="text-sm font-medium text-gray-600">{data.trend === 'up' ? '📈 Good' : '📉 Needs Attention'}</span>
      </div>
    </div>
  );
}
