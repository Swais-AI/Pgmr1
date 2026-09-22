'use client';

import { useState, useEffect } from 'react';
import { fetchParentChildren } from '@/lib/api';

interface ChildSelectorProps {
  currentStudentId: number;
  onSelect: (id: number) => void;
  disabled?: boolean;
  /**
   * parentId = 0 means "not yet loaded from localStorage".
   * The component will show a placeholder and skip fetching until
   * a real (> 0) parentId is provided.
   *
   * Set via: localStorage.setItem('sgs_parent_id', '<id>')  then refresh.
   * Discover seeded IDs via: GET /debug/seeded-parents
   */
  parentId?: number;
}

export default function ChildSelector({
  currentStudentId,
  onSelect,
  disabled,
  parentId = 0,
}: ChildSelectorProps) {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip fetch when parentId is 0 (not yet set in localStorage).
    if (!parentId) {
      setLoading(false);
      return;
    }

    const loadChildren = async () => {
      setLoading(true);
      try {
        const data = await fetchParentChildren(parentId);
        console.log('[SGS] ChildSelector: parent', parentId, '→', data.length, 'children', data);
        setChildren(data);

        // Auto-select the first child when the current studentId is not in the list
        // (covers fresh load with studentId=0 and parent switch).
        if (data.length > 0 && !data.find((c: any) => c.student_id === currentStudentId)) {
          console.log('[SGS] ChildSelector: auto-selecting student_id', data[0].student_id);
          onSelect(data[0].student_id);
        }
      } catch (error) {
        console.error('[SGS] ChildSelector: failed to load children for parent', parentId, error);
      } finally {
        setLoading(false);
      }
    };

    loadChildren();
  // Re-run only when parentId changes (not on every onSelect reference churn).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  // ── Skeleton while loading ────────────────────────────────────────────────
  if (loading) {
    return <div className="h-14 w-48 bg-gray-200 animate-pulse rounded-full" />;
  }

  // ── Parent ID not set — show a hint for the developer ────────────────────
  if (!parentId) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-3 py-2 bg-gray-50 rounded-full border border-gray-200">
        <span>👤</span>
        <span>Set <code className="font-mono">sgs_parent_id</code> in localStorage</span>
      </div>
    );
  }

  // ── No children returned for this parent ─────────────────────────────────
  if (children.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-3 py-2 bg-gray-50 rounded-full border border-gray-200">
        <span>👤</span>
        <span>No children found (parent {parentId})</span>
      </div>
    );
  }

  // ── Normal dropdown ───────────────────────────────────────────────────────
  const activeChild = children.find(c => c.student_id === currentStudentId);

  return (
    <div className="flex flex-col min-w-0 flex-1 max-w-[220px]">
      <label className="text-xs font-semibold text-gray-500 mb-1 ml-1">Select Child</label>
      <div className="flex items-center bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm min-w-0">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold mr-2">
          {activeChild?.full_name?.charAt(0) || 'S'}
        </div>
        <select
          value={currentStudentId}
          onChange={e => onSelect(Number(e.target.value))}
          disabled={disabled || loading}
          className="bg-transparent focus:outline-none disabled:opacity-50 text-gray-800 text-sm font-semibold appearance-none pr-6 cursor-pointer min-w-0 truncate"
          style={{
            backgroundImage:
              'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right center',
            backgroundSize: '1em',
          }}
        >
          {children.map(child => (
            <option key={child.student_id} value={child.student_id}>
              {child.full_name} • {child.class_name} {child.section}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
