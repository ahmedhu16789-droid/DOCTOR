import { Department, User, Branch } from './types';
import { MOCK_BRANCH_SEED, MOCK_USERS_SEED } from './services/mock/seed';

export const BRANCHES: Branch[] = MOCK_BRANCH_SEED.map(({ branch }) => branch);

export const DEPARTMENTS = [
  Department.ORTHOPEDICS,
  Department.CARDIOLOGY,
  Department.DENTISTRY,
  Department.INTERNAL_MEDICINE
];

export const MOCK_USERS: User[] = MOCK_USERS_SEED;
