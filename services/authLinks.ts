import { MOCK_USERS } from '../constants';
import { User } from '../types';
import { getAppBaseUrl, readCredentials, readLinks, writeCredentials, writeLinks } from './core/authLinksStore';

export const generateOneTimeAccessLink = (user: User): string => {
  if (!user.email) {
    throw new Error('User has no email');
  }

  const now = new Date().toISOString();
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const links = readLinks().map((link) => (
    link.userId === user.id && !link.usedAt && !link.revokedAt
      ? { ...link, revokedAt: now }
      : link
  ));

  links.push({
    token,
    userId: user.id,
    email: user.email.toLowerCase(),
    createdAt: now,
  });

  writeLinks(links);

  return `${getAppBaseUrl()}?accessToken=${encodeURIComponent(token)}`;
};

export const consumeOneTimeAccessLink = (params: { token: string; email: string; password: string }): User => {
  const { token, email, password } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const links = readLinks();
  const targetLink = links.find((link) => link.token === token);

  if (!targetLink || targetLink.usedAt || targetLink.revokedAt) {
    throw new Error('This link is invalid or already used.');
  }

  if (targetLink.email !== normalizedEmail) {
    throw new Error('Email does not match this access link.');
  }

  const fallbackUser = MOCK_USERS.find((user) => user.id === targetLink.userId || user.email?.toLowerCase() === normalizedEmail);
  const credentials = readCredentials();
  const storedCredential = credentials.find((item) => item.email === normalizedEmail || item.userId === targetLink.userId);
  const user = storedCredential?.user ?? fallbackUser;

  if (!user) {
    throw new Error('User not found for this link.');
  }

  const updatedCredentials = credentials.filter((item) => item.userId !== user.id && item.email !== normalizedEmail);
  updatedCredentials.push({
    userId: user.id,
    email: normalizedEmail,
    password,
    user: {
      ...user,
      email: normalizedEmail,
    },
    updatedAt: new Date().toISOString(),
  });
  writeCredentials(updatedCredentials);

  writeLinks(links.map((link) => (
    link.token === token
      ? { ...link, usedAt: new Date().toISOString() }
      : link
  )));

  return {
    ...user,
    email: normalizedEmail,
  };
};

export const authenticateWithLocalCredentials = (email: string, password: string): User | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const credentials = readCredentials();

  const matched = credentials.find((item) => item.email === normalizedEmail && item.password === password);
  return matched?.user ? { ...matched.user, email: normalizedEmail } : null;
};

export const hasValidAccessToken = (token: string): boolean => {
  const link = readLinks().find((item) => item.token === token);
  return Boolean(link && !link.usedAt && !link.revokedAt);
};
