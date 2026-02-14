import { MOCK_USERS } from '../../constants';
import { User } from '../../types';

const LINKS_KEY = 'afcm_one_time_links';
const CREDENTIALS_KEY = 'afcm_local_credentials';

export interface OneTimeAccessLink {
  token: string;
  userId: string;
  email: string;
  createdAt: string;
  usedAt?: string;
  revokedAt?: string;
}

export interface LocalCredential {
  userId: string;
  email: string;
  password: string;
  user: User;
  updatedAt: string;
}

export const readLinks = (): OneTimeAccessLink[] => {
  const raw = localStorage.getItem(LINKS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as OneTimeAccessLink[];
  } catch {
    localStorage.removeItem(LINKS_KEY);
    return [];
  }
};

export const writeLinks = (links: OneTimeAccessLink[]): void => {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
};

export const readCredentials = (): LocalCredential[] => {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (!raw) {
    const defaultCredentials = MOCK_USERS
      .filter((user) => Boolean(user.email))
      .map((user) => ({
        userId: user.id,
        email: user.email!,
        password: 'password123',
        user,
        updatedAt: new Date().toISOString(),
      }));

    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(defaultCredentials));
    return defaultCredentials;
  }

  try {
    return JSON.parse(raw) as LocalCredential[];
  } catch {
    localStorage.removeItem(CREDENTIALS_KEY);
    return [];
  }
};

export const writeCredentials = (credentials: LocalCredential[]): void => {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
};

export const getAppBaseUrl = (): string => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
};
