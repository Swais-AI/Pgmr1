'use client';

import { useState, useCallback } from 'react';
import { fetchAIAnalytics, buildUserInfo } from '@/lib/aiService';
import type { AIAnalyticsScope } from '@/lib/aiTypes';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'disabled';

interface UseAIAnalyticsReturn {
  status: Status;
  analysis: string | null;
  errorType: string | null;
  generate: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for the /parent/analytics AI endpoint.
 * Exposes a generate() trigger — never fires automatically on mount.
 * aiService handles 15-minute response caching, parentId zero-guard,
 * timeout, and HTTP-200 failure detection internally.
 */
export function useAIAnalytics(
  scope: AIAnalyticsScope,
  parentId: number,
  subject?: string,
): UseAIAnalyticsReturn {
  const [status,    setStatus]    = useState<Status>('idle');
  const [analysis,  setAnalysis]  = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (status === 'loading') return;

    setStatus('loading');
    setErrorType(null);

    const result = await fetchAIAnalytics({
      scope,
      subject,
      userInfo: buildUserInfo(parentId),
    });

    if (!result.success) {
      // Distinguish disabled from real errors so the UI can hide vs show message
      if (result.error === 'disabled' || result.error === 'not-ready') {
        setStatus('disabled');
      } else {
        setStatus('error');
        setErrorType(result.error);
      }
      return;
    }

    setAnalysis(result.data);
    setStatus('success');
  }, [scope, subject, parentId, status]);

  const reset = useCallback(() => {
    setStatus('idle');
    setAnalysis(null);
    setErrorType(null);
  }, []);

  return { status, analysis, errorType, generate, reset };
}
