import { getToken } from './authSession';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';
const inFlightRequests = new Map<string, Promise<unknown>>();
const getCache = new Map<string, { expiresAt: number; data: unknown }>();
const GET_CACHE_TTL_MS = Number(import.meta.env.VITE_API_GET_CACHE_TTL_MS ?? 15000);

const resolveMethod = (options: RequestInit): string => (options.method ?? 'GET').toUpperCase();
const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);
const getRequestUrl = (path: string): string => `${API_BASE_URL.replace(/\/$/, '')}${normalizePath(path)}`;

const createRequestKey = (path: string, options: RequestInit, withAuth: boolean, token: string | null): string => {
  const method = resolveMethod(options);
  const body = typeof options.body === 'string' ? options.body : '';
  return [method, path, withAuth ? token ?? '' : '', body].join('|');
};

export async function apiFetch<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const token = getToken();
  const method = resolveMethod(options);
  const hasAbortSignal = Boolean(options.signal);
  const shouldDeduplicate = method === 'GET' && !hasAbortSignal;
  const normalizedPath = normalizePath(path);
  const requestKey = createRequestKey(normalizedPath, options, withAuth, token);

  if (shouldDeduplicate) {
    const cached = getCache.get(requestKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    if (cached) {
      getCache.delete(requestKey);
    }
  }

  if (shouldDeduplicate) {
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(getRequestUrl(normalizedPath), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message ?? 'API request failed');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await response.json() as T;

    if (method === 'GET' && GET_CACHE_TTL_MS > 0) {
      getCache.set(requestKey, {
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
        data: payload,
      });
    }

    if (method !== 'GET') {
      getCache.clear();
    }

    return payload;
  })();

  if (!shouldDeduplicate) {
    return requestPromise;
  }

  inFlightRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(requestKey);
  }
}
