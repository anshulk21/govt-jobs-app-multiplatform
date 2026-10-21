import { useEffect, useState } from 'react';
import { todayIST } from '@/core/jobs';

/**
 * Today's date (IST). Pre-rendered web pages start with the date the site was
 * built (`builtAt`) so the HTML and the first client render match, then switch
 * to the real date after loading.
 */
export function useToday(builtAt?: string): string {
  const [today, setToday] = useState(() => todayIST(builtAt ? new Date(builtAt) : new Date()));
  useEffect(() => setToday(todayIST()), []);
  return today;
}

/** False during pre-rendering and the first client render; true after. Use for device-only content. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
