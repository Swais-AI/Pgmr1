'use client';

import { useState, useCallback } from 'react';
import { fetchAIAssignmentReport, buildUserInfo } from '@/lib/aiService';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'disabled';

interface UseAIAssignmentReportReturn {
  status: Status;
  report: string | null;
  errorType: string | null;
  generate: () => Promise<void>;
}

/**
 * Hook for the /parent/assignments AI endpoint.
 * Exposes a generate() trigger — never fires automatically on mount.
 * aiService handles 15-minute response caching, parentId zero-guard,
 * timeout, and `list` field stripping internally.
 */
export function useAIAssignmentReport(parentId: number): UseAIAssignmentReportReturn {
  const [status,    setStatus]    = useState<Status>('idle');
  const [report,    setReport]    = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (status === 'loading') return;

    setStatus('loading');
    setErrorType(null);

    const result = await fetchAIAssignmentReport({
      userInfo: buildUserInfo(parentId),
    });

    if (!result.success) {
      if (result.error === 'disabled' || result.error === 'not-ready') {
        setStatus('disabled');
      } else {
        setStatus('error');
        setErrorType(result.error);
      }
      return;
    }

    setReport(result.data);
    setStatus('success');
  }, [parentId, status]);

  return { status, report, errorType, generate };
}
