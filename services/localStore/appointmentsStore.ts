import { BRANCHES, MOCK_USERS } from '../../constants';
import {
  Appointment,
  AppointmentStatus,
  Branch,
  BranchOperationalSettings,
  BranchSettingsEnvelope,
  Department,
  Patient,
  PaymentEntry,
  PaymentMethod,
  PaymentStatus,
  User,
} from '../../types';
import type { ClinicSettingsPayload } from '../api';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS } from '../mockData';

const STORE_KEY = 'doctor:clinic:data';
const STORE_VERSION = 2;
const UI_STATE_PREFIX = 'doctor:ui';

const LEGACY_KEYS = {
  patients: 'doctor:mock:patients:v1',
  appointments: 'doctor:mock:appointments:v1',
  branches: 'doctor:mock:branches:v1',
  branchSettings: 'doctor:mock:branch-settings:v1',
  clinicSettings: 'doctor:mock:clinic-settings:v1',
};

const defaultClinicSettings: ClinicSettingsPayload = {
  name: 'Al-Fath Clinic', email: 'info@alfath.com', phone: '0100000000', website: '', timezone: 'Africa/Cairo', currency: 'EGP', logoUrl: '',
  commission_basis: 'PAID_AMOUNT', apply_on_discounted_amount: true, include_tax: false, clawback_on_refund: true, accrual_day_of_month: 1,
  tv_queue_display_mode: 'FULL_NAME', doctor_advanced_mode_enabled: false,
};

type ClinicStoreData = {
  users: User[];
  patients: Patient[];
  appointments: Appointment[];
  branches: Branch[];
  branchSettings: Record<string, BranchSettingsEnvelope>;
  clinicSettings: ClinicSettingsPayload;
};

type PersistedClinicStore = {
  version: number;
  updatedAt: string;
  data: ClinicStoreData;
};

const safeRead = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const buildDefaultData = (): ClinicStoreData => ({
  users: [...MOCK_USERS],
  patients: [...MOCK_PATIENTS],
  appointments: [...MOCK_APPOINTMENTS],
  branches: [...BRANCHES],
  branchSettings: {},
  clinicSettings: { ...defaultClinicSettings },
});

const migrateLegacyStore = (): PersistedClinicStore => {
  const base = buildDefaultData();

  const patients = safeRead<Patient[]>(LEGACY_KEYS.patients);
  const appointments = safeRead<Appointment[]>(LEGACY_KEYS.appointments);
  const branches = safeRead<Branch[]>(LEGACY_KEYS.branches);
  const branchSettings = safeRead<Record<string, BranchSettingsEnvelope>>(LEGACY_KEYS.branchSettings);
  const clinicSettings = safeRead<ClinicSettingsPayload>(LEGACY_KEYS.clinicSettings);

  const data: ClinicStoreData = {
    users: base.users,
    patients: patients ?? base.patients,
    appointments: appointments ?? base.appointments,
    branches: branches ?? base.branches,
    branchSettings: branchSettings ?? base.branchSettings,
    clinicSettings: clinicSettings ?? base.clinicSettings,
  };

  return {
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    data,
  };
};

const readStore = (): PersistedClinicStore => {
  const current = safeRead<PersistedClinicStore>(STORE_KEY);
  if (current && current.version === STORE_VERSION && current.data) {
    return current;
  }

  const migrated = migrateLegacyStore();
  localStorage.setItem(STORE_KEY, JSON.stringify(migrated));
  return migrated;
};

const writeStore = (updater: (data: ClinicStoreData) => ClinicStoreData): ClinicStoreData => {
  const current = readStore();
  const updatedData = updater(current.data);
  const next: PersistedClinicStore = {
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    data: updatedData,
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return updatedData;
};

const getOperationalFallback = (): BranchOperationalSettings => ({
  defaultSlotDurationMinutes: 30,
  workingHours: { start: '09:00', end: '17:00', days: [0, 1, 2, 3, 4, 5] },
  queueRules: { maxWaitingPatients: 30, allowOverbooking: false, autoCallEnabled: true },
  operationalFlags: { allowWalkIns: true, enableTelehealth: false, requirePrepayment: false },
});

export const clinicDataStore = {
  getUsers: (): User[] => readStore().data.users,
  saveUser: (user: User): User => {
    writeStore((data) => {
      const exists = data.users.some((item) => item.id === user.id);
      return {
        ...data,
        users: exists ? data.users.map((item) => (item.id === user.id ? user : item)) : [...data.users, user],
      };
    });
    return user;
  },

  getPatients: (): Patient[] => readStore().data.patients,
  createPatient: (patient: Pick<Patient, 'name' | 'phone' | 'age' | 'gender'> & { medicalHistorySummary?: string }): Patient => {
    const created: Patient = {
      ...patient,
      id: `p-${Date.now()}`,
      balance: 0,
      lastVisit: new Date().toISOString().slice(0, 10),
      medicalHistorySummary: patient.medicalHistorySummary ?? 'New Patient',
    };
    writeStore((data) => ({ ...data, patients: [...data.patients, created] }));
    return created;
  },

  getAppointments: (): Appointment[] => readStore().data.appointments,
  createAppointment: (payload: Partial<Appointment>): Appointment => {
    const created: Appointment = {
      id: `apt-${Date.now()}`,
      patientId: payload.patientId ?? '',
      patientName: payload.patientName ?? '',
      doctorId: payload.doctorId ?? '',
      doctorName: payload.doctorName ?? '',
      branchId: payload.branchId ?? '',
      date: payload.date ?? new Date().toISOString().slice(0, 10),
      timeSlot: payload.timeSlot ?? '09:00',
      department: payload.department ?? Department.INTERNAL_MEDICINE,
      status: payload.status ?? AppointmentStatus.SCHEDULED,
      type: payload.type ?? 'Consultation',
      billing: payload.billing ?? { items: [], subtotal: 0, discount: 0, total: 0, paidAmount: 0, status: PaymentStatus.UNPAID, transactions: [] },
      createdAt: payload.createdAt ?? new Date().toISOString(),
      ...payload,
    } as Appointment;

    writeStore((data) => ({ ...data, appointments: [...data.appointments, created] }));
    return created;
  },

  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus): Appointment | null => {
    let updated: Appointment | null = null;
    writeStore((data) => ({
      ...data,
      appointments: data.appointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;
        updated = { ...appointment, status };
        return updated;
      }),
    }));
    return updated;
  },

  startVisitNow: (appointmentId: string): Appointment | null => {
    let updated: Appointment | null = null;
    writeStore((data) => ({
      ...data,
      appointments: data.appointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;
        updated = { ...appointment, status: AppointmentStatus.IN_PROGRESS, startedAt: new Date().toISOString() };
        return updated;
      }),
    }));
    return updated;
  },

  processAppointmentPayment: (appointmentId: string, payload: { amount?: number; method?: PaymentMethod; payments?: PaymentEntry[] }): Appointment | null => {
    let updated: Appointment | null = null;
    writeStore((data) => ({
      ...data,
      appointments: data.appointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;

        const payments = payload.payments?.length ? payload.payments : [{ amount: payload.amount ?? 0, method: payload.method ?? PaymentMethod.CASH }];
        const paymentTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const nextPaid = (appointment.billing?.paidAmount ?? 0) + paymentTotal;
        const total = appointment.billing?.total ?? 0;
        const status = nextPaid <= 0
          ? PaymentStatus.UNPAID
          : nextPaid >= total
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIAL;

        updated = {
          ...appointment,
          billing: {
            ...appointment.billing,
            paidAmount: nextPaid,
            status,
            transactions: [
              ...(appointment.billing?.transactions ?? []),
              ...payments.map((payment) => ({
                id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                amount: payment.amount,
                method: payment.method,
                timestamp: new Date().toISOString(),
                recordedBy: 'mock-user',
                type: 'PAYMENT' as const,
              })),
            ],
          },
        };
        return updated;
      }),
    }));
    return updated;
  },

  getBranches: (): Branch[] => readStore().data.branches,
  createBranch: (branch: Omit<Branch, 'id'>): Branch => {
    const created: Branch = { ...branch, id: `b-${Date.now()}` };
    writeStore((data) => ({ ...data, branches: [...data.branches, created] }));
    return created;
  },
  updateBranch: (branch: Branch): Branch => {
    writeStore((data) => ({ ...data, branches: data.branches.map((item) => (item.id === branch.id ? branch : item)) }));
    return branch;
  },
  deleteBranch: (branchId: string): void => {
    writeStore((data) => ({ ...data, branches: data.branches.filter((branch) => branch.id !== branchId) }));
  },

  getBranchSettings: (branchId: string): BranchSettingsEnvelope => {
    const current = readStore().data.branchSettings[branchId];
    return current ?? { precedence: 'default', defaults: getOperationalFallback(), overrides: {}, effective: getOperationalFallback() };
  },
  updateBranchSettings: (branchId: string, settings: BranchOperationalSettings): BranchSettingsEnvelope => {
    const envelope: BranchSettingsEnvelope = { precedence: 'branch', defaults: getOperationalFallback(), overrides: settings, effective: settings };
    writeStore((data) => ({ ...data, branchSettings: { ...data.branchSettings, [branchId]: envelope } }));
    return envelope;
  },
  resetBranchSettings: (branchId: string): BranchSettingsEnvelope => {
    writeStore((data) => {
      const copy = { ...data.branchSettings };
      delete copy[branchId];
      return { ...data, branchSettings: copy };
    });
    return { precedence: 'default', defaults: getOperationalFallback(), overrides: {}, effective: getOperationalFallback() };
  },

  getClinicSettings: (): ClinicSettingsPayload => readStore().data.clinicSettings,
  updateClinicSettings: (settings: ClinicSettingsPayload): ClinicSettingsPayload => {
    writeStore((data) => ({ ...data, clinicSettings: settings }));
    return settings;
  },
};

export const uiStateStore = {
  getKey: (userId: string, scope: string): string => `${UI_STATE_PREFIX}:${userId}:${scope}`,
  read: <T,>(userId: string, scope: string, fallback: T): T => {
    const value = safeRead<T>(`${UI_STATE_PREFIX}:${userId}:${scope}`);
    return value ?? fallback;
  },
  write: (userId: string, scope: string, value: unknown): void => {
    localStorage.setItem(`${UI_STATE_PREFIX}:${userId}:${scope}`, JSON.stringify(value));
  },
};
