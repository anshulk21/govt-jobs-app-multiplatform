// Apps: page data is fetched from the website's JSON API (same payload the web loader returns).
import { useApi, type ApiState } from './api';

export function useRouteData<T>(apiPath: string): ApiState<T> {
  return useApi<T>(apiPath);
}
