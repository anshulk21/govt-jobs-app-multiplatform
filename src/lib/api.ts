// Fetches the static JSON API (/api/...) with an offline cache.
// Web: same-origin paths. Apps: the website in production, the dev server in development.
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { APP } from '@/config/app';
import { readJson, writeJson } from './storage';

export function apiUrl(path: string): string {
  if (Platform.OS === 'web') return path;
  const devHost = __DEV__ ? Constants.expoConfig?.hostUri : undefined;
  return `${devHost ? `http://${devHost}` : APP.siteUrl}${path}`;
}

const memory = new Map<string, unknown>();
const cacheKey = (path: string) => `api:${path}`;

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : `HTTP ${res.status}`);
  const data = (await res.json()) as T;
  memory.set(path, data);
  void writeJson(cacheKey(path), data);
  return data;
}

export interface ApiState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  /** True when showing saved data because the network failed. */
  offline: boolean;
  refresh: () => Promise<void>;
}

/** Shows cached data immediately (if any), then refreshes from the network. Pass null to skip. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | undefined>(() => (path ? (memory.get(path) as T | undefined) : undefined));
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await fetchJson<T>(path));
      setError(null);
      setOffline(false);
    } catch (err) {
      const cached = (memory.get(path) as T | undefined) ?? (await readJson<T>(cacheKey(path))) ?? undefined;
      if (cached !== undefined) {
        setData(cached);
        setOffline(true);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    if (path && !memory.has(path)) {
      void readJson<T>(cacheKey(path)).then((cached) => {
        if (!cancelled && cached) setData((d) => d ?? cached);
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [path, load]);

  return { data, loading, error, offline, refresh: load };
}
