import { getToken } from './authSession';
import { handleMockRequest } from './mockEngine';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';
const inFlightRequests = new Map<string, Promise<unknown>>();
const getCache = new Map<string, { expiresAt: number; data: unknown }>();
const GET_CACHE_TTL_MS = Number(import.meta.env.VITE_API_GET_CACHE_TTL_MS ?? 15000);
const AUTH_MODE = ((import.meta.env.VITE_AUTH_MODE as string | undefined) ?? 'bearer').toLowerCase();
const USE_COOKIE_AUTH = AUTH_MODE === 'cookie';

const resolveMethod = (options: RequestInit): string => (options.method ?? 'GET').toUpperCase();
const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);
const getRequestUrl = (path: string): string => `${API_BASE_URL.replace(/\/$/, '')}${normalizePath(path)}`;
const isMutationMethod = (method: string): boolean => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

const createRequestKey = (path: string, options: RequestInit, withAuth: boolean, token: string | null): string => {
  const method = resolveMethod(options);
  const body = typeof options.body === 'string' ? options.body : '';
  return [method, path, withAuth ? token ?? '' : '', body, USE_COOKIE_AUTH ? 'cookie' : 'bearer'].join('|');
};

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const getCsrfToken = (): string | null => {
  return readCookie('XSRF-TOKEN') ?? readCookie('csrf_token');
};

const buildAuthHeaders = (withAuth: boolean, token: string | null, method: string): Record<string, string> => {
  if (!withAuth) return {};

  if (USE_COOKIE_AUTH) {
    const csrfToken = isMutationMethod(method) ? getCsrfToken() : null;
    return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
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
    if (import.meta.env.VITE_DATA_SOURCE_MODE === 'mock') {
      return await handleMockRequest<T>(normalizedPath, { ...options, method });
    }

    const response = await fetch(getRequestUrl(normalizedPath), {
      ...options,
      credentials: USE_COOKIE_AUTH ? 'include' : (options.credentials ?? 'same-origin'),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...buildAuthHeaders(withAuth, token, method),
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
