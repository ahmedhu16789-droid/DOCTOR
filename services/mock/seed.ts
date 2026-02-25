import {
  Appointment,
  AppointmentStatus,
  Branch,
  Department,
  Patient,
  PaymentMethod,
  PaymentStatus,
  User,
  UserRole,
  WeeklyShift
} from '../../types';

export interface ClinicSeedEntity {
  id: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface BranchSeed {
  branch: Branch;
  metadata: {
    code: string;
    region: string;
    supportsLab: boolean;
    supportsRadiology: boolean;
  };
}

const today = new Date().toISOString().split('T')[0];

export const MOCK_CLINIC: ClinicSeedEntity = {
  id: 'clinic_alfath',
  code: 'ALFATH',
  name: 'Al-Fath Clinics',
  timezone: 'Africa/Cairo',
  currency: 'EGP'
};

export const MOCK_BRANCH_SEED: BranchSeed[] = [
  {
    branch: { id: 'b1', name: 'Al-Fath Main', location: 'Downtown', contactPhone: '0100000001', isActive: true },
    metadata: { code: 'MAIN', region: 'Central', supportsLab: true, supportsRadiology: true }
  },
  {
    branch: { id: 'b2', name: 'Al-Fath North', location: 'North District', contactPhone: '0100000002', isActive: true },
    metadata: { code: 'NORTH', region: 'North', supportsLab: true, supportsRadiology: false }
  },
  {
    branch: { id: 'b3', name: 'Al-Fath West', location: 'West Suburbs', contactPhone: '0100000003', isActive: true },
    metadata: { code: 'WEST', region: 'West', supportsLab: false, supportsRadiology: false }
  }
];

export const MOCK_SCHEDULES: Record<string, WeeklyShift[]> = {
  u1: [
    { id: 's1', dayOfWeek: 1, startTime: '09:00', endTime: '14:00', branchId: 'b1', slotDuration: 20 },
    { id: 's2', dayOfWeek: 3, startTime: '09:00', endTime: '14:00', branchId: 'b1', slotDuration: 20 },
    { id: 's3', dayOfWeek: 2, startTime: '14:00', endTime: '18:00', branchId: 'b2', slotDuration: 30 },
    { id: 's4', dayOfWeek: 4, startTime: '14:00', endTime: '18:00', branchId: 'b2', slotDuration: 30 }
  ],
  u3: [
    { id: 's5', dayOfWeek: 0, startTime: '10:00', endTime: '16:00', branchId: 'b1', slotDuration: 15 },
    { id: 's6', dayOfWeek: 1, startTime: '10:00', endTime: '16:00', branchId: 'b1', slotDuration: 15 },
    { id: 's7', dayOfWeek: 2, startTime: '10:00', endTime: '16:00', branchId: 'b1', slotDuration: 15 }
  ]
};

export const MOCK_USERS_SEED: User[] = [
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
    schedule: MOCK_SCHEDULES.u1
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
    schedule: MOCK_SCHEDULES.u3
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
  },
  {
    id: 'u6',
    name: 'Nour Hassan',
    role: UserRole.RECEPTIONIST,
    assignedBranches: ['b2'],
    avatarUrl: 'https://picsum.photos/100/100?random=6',
    email: 'nour@alfath.com',
    status: 'ACTIVE'
  }
];

export const MOCK_PATIENTS_SEED: Patient[] = [
  {
    id: 'p1',
    name: 'Ahmed Mahmoud',
    age: 45,
    gender: 'Male',
    phone: '01001234567',
    lastVisit: '2023-10-15',
    medicalHistorySummary: 'Hypertension, Diabetic Type 2',
    allergies: ['Penicillin', 'Peanuts'],
    chronicConditions: ['Hypertension', 'Diabetes T2'],
    balance: 0
  },
  {
    id: 'p2',
    name: 'Layla Hassan',
    age: 28,
    gender: 'Female',
    phone: '01119876543',
    lastVisit: '2023-11-01',
    medicalHistorySummary: 'Asthma, Penicillin Allergy',
    allergies: ['Dust Mites', 'Aspirin'],
    chronicConditions: ['Asthma'],
    balance: 150
  },
  {
    id: 'p3',
    name: 'Ibrahim Youssef',
    age: 42,
    gender: 'Male',
    phone: '01223334444',
    lastVisit: '2023-11-20',
    medicalHistorySummary: 'None',
    balance: 0
  }
];

export const MOCK_APPOINTMENTS_SEED: Appointment[] = [
  {
    id: 'apt1',
    patientId: 'p1',
    patientName: 'Ahmed Mahmoud',
    doctorId: 'u1',
    doctorName: 'Dr. Sarah Ahmed',
    branchId: 'b1',
    date: today,
    timeSlot: '09:00',
    department: Department.CARDIOLOGY,
    status: AppointmentStatus.IN_PROGRESS,
    type: 'Consultation',
    notes: 'Checking BP medication',
    createdAt: `${today}T08:00:00.000Z`,
    billing: {
      items: [
        {
          id: '1',
          serviceId: 'srv_cns',
          name: 'Specialist Consultation',
          quantity: 1,
          unitPrice: 400,
          total: 400,
          addedBy: 'system',
          timestamp: today
        }
      ],
      subtotal: 400,
      discount: 0,
      total: 400,
      paidAmount: 0,
      status: PaymentStatus.UNPAID,
      transactions: []
    }
  },
  {
    id: 'apt2',
    patientId: 'p2',
    patientName: 'Layla Hassan',
    doctorId: 'u1',
    doctorName: 'Dr. Sarah Ahmed',
    branchId: 'b1',
    date: today,
    timeSlot: '09:40',
    department: Department.CARDIOLOGY,
    status: AppointmentStatus.WAITING,
    type: 'Follow-up',
    createdAt: `${today}T08:20:00.000Z`,
    billing: {
      items: [
        {
          id: '2',
          serviceId: 'srv_fol',
          name: 'Follow-up Visit',
          quantity: 1,
          unitPrice: 150,
          total: 150,
          addedBy: 'system',
          timestamp: today
        }
      ],
      subtotal: 150,
      discount: 0,
      total: 150,
      paidAmount: 150,
      status: PaymentStatus.PAID,
      transactions: [
        {
          id: 'tx1',
          amount: 150,
          method: PaymentMethod.CASH,
          timestamp: today,
          recordedBy: 'u2',
          reference: 'REC-001',
          type: 'PAYMENT'
        }
      ]
    }
  },
  {
    id: 'apt3',
    patientId: 'p3',
    patientName: 'Ibrahim Youssef',
    doctorId: 'u3',
    doctorName: 'Dr. Kareem Ezz',
    branchId: 'b1',
    date: today,
    timeSlot: '10:00',
    department: Department.ORTHOPEDICS,
    status: AppointmentStatus.SCHEDULED,
    type: 'Consultation',
    createdAt: `${today}T08:40:00.000Z`,
    billing: {
      items: [
        {
          id: '3',
          serviceId: 'srv_cns',
          name: 'Specialist Consultation',
          quantity: 1,
          unitPrice: 400,
          total: 400,
          addedBy: 'system',
          timestamp: today
        }
      ],
      subtotal: 400,
      discount: 0,
      total: 400,
      paidAmount: 0,
      status: PaymentStatus.UNPAID,
      transactions: []
    }
  }
];

export const getBranchById = (branchId: string): Branch | undefined =>
  MOCK_BRANCH_SEED.find(({ branch }) => branch.id === branchId)?.branch;

export const getBranchMetadataById = (branchId: string): BranchSeed['metadata'] | undefined =>
  MOCK_BRANCH_SEED.find(({ branch }) => branch.id === branchId)?.metadata;

export const getDoctorsByBranch = (branchId: string): User[] =>
  MOCK_USERS_SEED.filter((user) => user.role === UserRole.DOCTOR && user.assignedBranches.includes(branchId));

export const getReceptionByBranch = (branchId: string): User[] =>
  MOCK_USERS_SEED.filter((user) => user.role === UserRole.RECEPTIONIST && user.assignedBranches.includes(branchId));

export const getUsersByBranch = (branchId: string): User[] =>
  MOCK_USERS_SEED.filter((user) => user.assignedBranches.includes(branchId));

export const getAppointmentsByBranch = (branchId: string): Appointment[] =>
  MOCK_APPOINTMENTS_SEED.filter((appointment) => appointment.branchId === branchId);

export const getAppointmentsByDoctor = (doctorId: string): Appointment[] =>
  MOCK_APPOINTMENTS_SEED.filter((appointment) => appointment.doctorId === doctorId);
