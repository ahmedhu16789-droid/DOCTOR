import { Department, UserRole, Branch, User } from './types';
import { MOCK_SCHEDULES } from './services/mockData';

export const BRANCHES: Branch[] = [
  { id: 'b1', name: 'Al-Fath Main', location: 'Downtown', contactPhone: '0100000001', isActive: true },
  { id: 'b2', name: 'Al-Fath North', location: 'North District', contactPhone: '0100000002', isActive: true },
  { id: 'b3', name: 'Al-Fath West', location: 'West Suburbs', contactPhone: '0100000003', isActive: true },
];

export const DEPARTMENTS = [
  Department.ORTHOPEDICS,
  Department.CARDIOLOGY,
  Department.DENTISTRY,
  Department.INTERNAL_MEDICINE
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Dr. Sarah Ahmed',
    role: UserRole.DOCTOR,
    specialty: Department.CARDIOLOGY,
    assignedBranches: ['b1', 'b2'],
    avatarUrl: 'https://picsum.photos/100/100?random=1',
    consultationFee: 400,
    email: 'sarah@alfath.com',
    status: 'ACTIVE',
    schedule: MOCK_SCHEDULES['u1']
  },
  {
    id: 'u2',
    name: 'Mona Aly',
    role: UserRole.RECEPTIONIST,
    assignedBranches: ['b1'],
    avatarUrl: 'https://picsum.photos/100/100?random=2',
    email: 'mona@alfath.com',
    status: 'ACTIVE'
  },
  {
    id: 'u3',
    name: 'Dr. Kareem Ezz',
    role: UserRole.DOCTOR,
    specialty: Department.ORTHOPEDICS,
    assignedBranches: ['b1'],
    avatarUrl: 'https://picsum.photos/100/100?random=3',
    consultationFee: 450,
    email: 'kareem@alfath.com',
    status: 'ACTIVE',
    schedule: MOCK_SCHEDULES['u3']
  },
  {
    id: 'u4',
    name: 'Manager Hossam',
    role: UserRole.BRANCH_MANAGER,
    assignedBranches: ['b1', 'b2'],
    avatarUrl: 'https://picsum.photos/100/100?random=4',
    email: 'hossam@alfath.com',
    status: 'ACTIVE'
  },
  {
    id: 'u5',
    name: 'Dr. Owner',
    role: UserRole.ADMIN,
    assignedBranches: ['b1', 'b2', 'b3'],
    avatarUrl: 'https://picsum.photos/100/100?random=5',
    email: 'admin@alfath.com',
    status: 'ACTIVE'
  }
];