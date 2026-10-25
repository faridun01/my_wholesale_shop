import { useCallback, useEffect, useRef, useState } from 'react';
import { getStaffSummary, type StaffSummary } from '../../api/staff.api';
import type { StaffPeriod } from './staffPeriod';

/** Loads one staff member's figures for a period; `reload` refetches in place. */
export default function useStaffSummary(userId: number | null, period: StaffPeriod) {
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [hasError, setHasError] = useState(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setHasError(false);

    try {
      const data = await getStaffSummary(userId, { start: period.start, end: period.end });
      if (requestId === requestIdRef.current) setSummary(data);
    } catch {
      if (requestId === requestIdRef.current) setHasError(true);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [userId, period.start, period.end]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, isLoading, hasError, reload };
}
