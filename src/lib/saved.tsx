// Saved jobs, stored in full on the device so they work offline.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Job } from '@/core/types';
import { track } from './analytics';
import { useLimit } from './pro';
import { readJson, writeJson } from './storage';

export interface SavedJob {
  job: Job;
  savedAt: string;
  /** job.updatedAt when the user last opened it; a newer updatedAt means "Updated". */
  seenUpdatedAt: string;
}

const KEY = 'saved:v1';

interface SavedContextValue {
  saved: SavedJob[];
  isSaved: (slug: string) => boolean;
  /** 'limit' = free users' saved-jobs limit reached (show the Pro screen). */
  toggle: (job: Job) => 'saved' | 'removed' | 'limit';
  remove: (slug: string) => void;
  /** Store the latest copy of a saved job (e.g. after opening it online). */
  refreshJob: (job: Job, markSeen: boolean) => void;
}

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedJob[]>([]);
  const limit = useLimit('savedJobs');

  useEffect(() => {
    void readJson<SavedJob[]>(KEY).then((s) => s && setSaved(s));
  }, []);

  const commit = useCallback((fn: (prev: SavedJob[]) => SavedJob[]) => {
    setSaved((prev) => {
      const next = fn(prev);
      void writeJson(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<SavedContextValue>(
    () => ({
      saved,
      isSaved: (slug) => saved.some((s) => s.job.slug === slug),
      toggle: (job) => {
        if (saved.some((s) => s.job.slug === job.slug)) {
          commit((prev) => prev.filter((s) => s.job.slug !== job.slug));
          return 'removed';
        }
        if (saved.length >= limit) return 'limit';
        commit((prev) => [{ job, savedAt: new Date().toISOString(), seenUpdatedAt: job.updatedAt }, ...prev]);
        track('job_save', { category: job.category, state: job.state ?? 'central' });
        return 'saved';
      },
      remove: (slug) => commit((prev) => prev.filter((s) => s.job.slug !== slug)),
      refreshJob: (job, markSeen) =>
        commit((prev) =>
          prev.map((s) => (s.job.slug === job.slug ? { ...s, job, seenUpdatedAt: markSeen ? job.updatedAt : s.seenUpdatedAt } : s)),
        ),
    }),
    [saved, commit, limit],
  );
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>');
  return ctx;
}
