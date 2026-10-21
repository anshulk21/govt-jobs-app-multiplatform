// Web: page data comes from the route's `loader`, so it is baked into the static HTML (SEO).
import { useLoaderData } from 'expo-router';
import type { ApiState } from './api';

const noop = async () => {};

export function useRouteData<T>(_apiPath: string): ApiState<T> {
  const data = useLoaderData() as T | null;
  return { data: data ?? undefined, loading: false, error: data ? null : 'Not found', offline: false, refresh: noop };
}
