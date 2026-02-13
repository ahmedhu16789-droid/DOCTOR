import { Appointment, AppointmentStatus, Department, Patient, PaymentMethod, PaymentStatus, User, UserRole } from '../types';
import { MOCK_USERS } from '../constants';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'afcm_api_token';

interface ApiUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}

interface ApiLoginResponse {
  token: string;
  user: ApiUser;
  clinicId: string;
}

interface ApiAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  branchId: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  billing: {
    total: number;
    paidAmount: number;
    status: PaymentStatus;
  };
}

interface ApiPatient {
  id: string;
  name: string;
  phone: string;
  gender: 'Male' | 'Female';
  age: number;
  medicalHistorySummary: string;
}

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const clearAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

async function apiFetch<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? 'API request failed');
  }

  return response.json() as Promise<T>;
}

const normalizeUser = (apiUser: ApiUser): User => {
  const fallbackUser = MOCK_USERS.find((u) => u.id === apiUser.id || u.email === apiUser.email);

  return {
    id: apiUser.id,
    name: apiUser.name,
    role: apiUser.role,
    email: apiUser.email,
    assignedBranches: fallbackUser?.assignedBranches ?? [],
    specialty: fallbackUser?.specialty,
    consultationFee: fallbackUser?.consultationFee,
    schedule: fallbackUser?.schedule,
    avatarUrl: fallbackUser?.avatarUrl,
  };
};

const normalizePatient = (patient: ApiPatient): Patient => ({
  id: patient.id,
  name: patient.name,
  age: patient.age,
  gender: patient.gender,
  phone: patient.phone,
  medicalHistorySummary: patient.medicalHistorySummary,
  lastVisit: '-',
  balance: 0,
});

const mapAppointmentType = (status: AppointmentStatus): 'Consultation' | 'Follow-up' | 'Procedure' => {
  if (status === AppointmentStatus.COMPLETED) return 'Follow-up';
  return 'Consultation';
};

const normalizeAppointment = (appointment: ApiAppointment, patients: Patient[]): Appointment => {
  const doctor = MOCK_USERS.find((u) => u.id === appointment.doctorId);
  const patient = patients.find((p) => p.id === appointment.patientId);

  return {
    id: appointment.id,
    patientId: appointment.patientId,
    patientName: patient?.name ?? 'Unknown Patient',
    doctorId: appointment.doctorId,
    doctorName: doctor?.name ?? 'Doctor',
    branchId: appointment.branchId,
    date: appointment.date,
    timeSlot: appointment.timeSlot,
    department: doctor?.specialty ?? Department.INTERNAL_MEDICINE,
    status: appointment.status,
    type: mapAppointmentType(appointment.status),
    createdAt: new Date().toISOString(),
    billing: {
      items: [],
      subtotal: appointment.billing.total,
      discount: 0,
      total: appointment.billing.total,
      paidAmount: appointment.billing.paidAmount,
      status: appointment.billing.status,
      transactions: appointment.billing.paidAmount > 0 ? [{
        id: `tx-${appointment.id}`,
        amount: appointment.billing.paidAmount,
        method: PaymentMethod.CASH,
        timestamp: new Date().toISOString(),
        recordedBy: 'system',
        type: 'PAYMENT'
      }] : [],
    },
  };
};

export const loginWithApi = async (email: string, password: string): Promise<User> => {
  const response = await apiFetch<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);

  setToken(response.token);
  return normalizeUser(response.user);
};

export const getPatientsFromApi = async (): Promise<Patient[]> => {
  const payload = await apiFetch<{ data: ApiPatient[] }>('/patients');
  return (payload.data ?? []).map(normalizePatient);
};

export const getAppointmentsFromApi = async (patients: Patient[]): Promise<Appointment[]> => {
  const payload = await apiFetch<{ data: ApiAppointment[] }>('/appointments');
  return (payload.data ?? []).map((apt) => normalizeAppointment(apt, patients));
};

export const createAppointmentViaApi = async (appointment: Partial<Appointment>): Promise<void> => {
  if (!appointment.patientId || !appointment.doctorId || !appointment.branchId || !appointment.date || !appointment.timeSlot) {
    throw new Error('Incomplete appointment payload');
  }

  await apiFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      patientId: Number(appointment.patientId),
      doctorId: Number(appointment.doctorId),
      branchId: Number(appointment.branchId),
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: appointment.status ?? AppointmentStatus.SCHEDULED,
      billing: {
        total: appointment.billing?.total ?? 0,
        paidAmount: appointment.billing?.paidAmount ?? 0,
        status: appointment.billing?.status ?? PaymentStatus.UNPAID,
      },
    }),
  });
};
