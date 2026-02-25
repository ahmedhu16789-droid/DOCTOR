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
import { DEFAULT_CLINIC_SETTINGS } from './clinicSettingsStore';
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
  clinicSettings: { ...DEFAULT_CLINIC_SETTINGS },
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

  addBillingItem: (appointmentId: string, payload: { serviceId?: string; name: string; category?: string; quantity?: number; unitPrice: number }): Appointment | null => {
    let updated: Appointment | null = null;
    writeStore((data) => ({
      ...data,
      appointments: data.appointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;

        const qty = payload.quantity ?? 1;
        const total = qty * payload.unitPrice;

        const newItem = {
          id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          serviceId: payload.serviceId ?? 'srv_custom',
          name: payload.name,
          category: payload.category ?? 'General',
          quantity: qty,
          unitPrice: payload.unitPrice,
          total,
          addedBy: 'mock-user',
          timestamp: new Date().toISOString(),
        };

        const existingItems = appointment.billing?.items ?? [];
        const nextItems = [...existingItems, newItem];
        const nextSubtotal = nextItems.reduce((sum, item) => sum + item.total, 0);
        const nextTotal = nextSubtotal - (appointment.billing?.discount ?? 0);
        const nextPaid = appointment.billing?.paidAmount ?? 0;

        const status = nextPaid <= 0 ? PaymentStatus.UNPAID : nextPaid >= nextTotal ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

        updated = {
          ...appointment,
          billing: {
            ...appointment.billing,
            items: nextItems,
            subtotal: nextSubtotal,
            total: nextTotal,
            status,
          } as any, // Cast necessary if TS complains about partial billing type structures
        };
        return updated;
      }),
    }));
    return updated;
  },

  removeBillingItem: (appointmentId: string, itemId: string): Appointment | null => {
    let updated: Appointment | null = null;
    writeStore((data) => ({
      ...data,
      appointments: data.appointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;

        const existingItems = appointment.billing?.items ?? [];
        const nextItems = existingItems.filter(item => item.id !== itemId);
        const nextSubtotal = nextItems.reduce((sum, item) => sum + item.total, 0);
        const nextTotal = nextSubtotal - (appointment.billing?.discount ?? 0);
        const nextPaid = appointment.billing?.paidAmount ?? 0;

        const status = nextPaid <= 0 ? PaymentStatus.UNPAID : nextPaid >= nextTotal ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

        updated = {
          ...appointment,
          billing: {
            ...appointment.billing,
            items: nextItems,
            subtotal: nextSubtotal,
            total: nextTotal,
            status,
          } as any,
        };
        return updated;
      }),
    }));
    return updated;
  },

  shiftAppointments: (params: {
    doctorId: string;
    branchId: string;
    date: string;
    fromTime: string;
    shiftMinutes: number;
  }): {
    shiftedAppointments: number;
    shiftedData: Array<{
      appointmentId: string;
      patientId: string;
      patientName?: string | null;
      patientPhone?: string | null;
      beforeTime: string;
      afterTime: string;
    }>;
  } => {
    const blockedStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ]);

    const shiftedData: Array<{
      appointmentId: string;
      patientId: string;
      patientName?: string | null;
      patientPhone?: string | null;
      beforeTime: string;
      afterTime: string;
    }> = [];

    const normalizeDate = (value: string): string => (value.includes('T') ? value.split('T')[0] : value);

    const toMinutes = (time: string): number => {
      const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (!match) {
        return Number.NaN;
      }

      const hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);

      if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return Number.NaN;
      }

      return (hours * 60) + minutes;
    };

    const formatMinutes = (minutes: number): string => {
      const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
      const shiftedHours = Math.floor(normalized / 60);
      const shiftedMinutePart = normalized % 60;

      return `${String(shiftedHours).padStart(2, '0')}:${String(shiftedMinutePart).padStart(2, '0')}`;
    };

    const fromMinutes = toMinutes(params.fromTime);
    if (Number.isNaN(fromMinutes)) {
      return {
        shiftedAppointments: 0,
        shiftedData,
      };
    }

    const migrationDate = normalizeDate(params.date);

    writeStore((data) => {
      const patientById = new Map(data.patients.map((patient) => [patient.id, patient]));

      const appointments = data.appointments.map((appointment) => {
        if (
          appointment.doctorId !== params.doctorId
          || appointment.branchId !== params.branchId
          || normalizeDate(appointment.date) !== migrationDate
          || blockedStatuses.has(appointment.status)
        ) {
          return appointment;
        }

        const appointmentMinutes = toMinutes(appointment.timeSlot);
        if (Number.isNaN(appointmentMinutes) || appointmentMinutes < fromMinutes) {
          return appointment;
        }

        const afterTime = formatMinutes(appointmentMinutes + params.shiftMinutes);
        const patient = patientById.get(appointment.patientId);

        shiftedData.push({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          patientName: patient?.name ?? appointment.patientName,
          patientPhone: patient?.phone,
          beforeTime: appointment.timeSlot,
          afterTime,
        });

        return {
          ...appointment,
          timeSlot: afterTime,
        };
      });

      return {
        ...data,
        appointments,
      };
    });

    shiftedData.sort((first, second) => {
      const firstMinutes = toMinutes(first.beforeTime);
      const secondMinutes = toMinutes(second.beforeTime);

      if (Number.isNaN(firstMinutes) || Number.isNaN(secondMinutes)) {
        return first.beforeTime.localeCompare(second.beforeTime);
      }

      return firstMinutes - secondMinutes;
    });

    return {
      shiftedAppointments: shiftedData.length,
      shiftedData,
    };
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
