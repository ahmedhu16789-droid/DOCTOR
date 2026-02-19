import { getToken } from './authSession';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';
const inFlightRequests = new Map<string, Promise<unknown>>();

const resolveMethod = (options: RequestInit): string => (options.method ?? 'GET').toUpperCase();

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
  const requestKey = createRequestKey(path, options, withAuth, token);

  if (shouldDeduplicate) {
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
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

    return response.json() as Promise<T>;
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
