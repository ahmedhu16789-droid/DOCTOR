import { User } from '../../types';

const USER_KEY = 'afcm_current_user';
const TOKEN_KEY = 'afcm_auth_token';
const TOKEN_TTL_MS = Number(import.meta.env.VITE_AUTH_TOKEN_TTL_MS ?? 5 * 60 * 1000);

let memoryToken: { value: string; expiresAt: number } | null = null;

export const getToken = (): string | null => {
  if (!memoryToken) {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      try {
        memoryToken = JSON.parse(stored);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  if (!memoryToken) return null;
  if (memoryToken.expiresAt <= Date.now()) {
    memoryToken = null;
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  return memoryToken.value;
};

export const setToken = (token: string): void => {
  memoryToken = {
    value: token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(memoryToken));
};

export const clearAuthSession = (): void => {
  memoryToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const setStoredUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
