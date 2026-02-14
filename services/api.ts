import { Appointment, AppointmentStatus, Branch, Department, Patient, PaymentMethod, PaymentStatus, User, UserRole } from '../types';
import { MOCK_USERS } from '../constants';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'afcm_api_token';
const USER_KEY = 'afcm_current_user';
const patientLookupCache = new Map<string, { ts: number; data: Patient[] }>();

interface ApiUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  assignedBranches?: string[];
  schedule?: User['schedule'];
  activeBranchId?: string | null;
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

interface ApiBranch {
  id: string;
  name: string;
  location: string;
  contactPhone: string;
  isActive: boolean;
}

interface ApiDoctor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  specialty: Department;
  consultationFee: number;
  assignedBranches: string[];
  schedule?: User['schedule'];
  payroll?: User['payroll'];
}


interface ApiEmployee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  jobTitle: string;
  assignedBranches: string[];
  schedule?: User['schedule'];
  payroll?: User['payroll'];
}

interface ApiRoleOption {
  value: UserRole;
  label: string;
}

export interface ClinicSettingsPayload {
  name: string;
  email: string;
  phone: string;
  website: string;
  timezone: string;
  currency: string;
  logoUrl: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  cashCollected: number;
  outstandingRevenue: number;
  averageTicket: number;
}

export interface FinancialRevenueByDoctor {
  doctorName: string;
  amount: number;
}

export interface FinancialRevenueByBranch {
  branchId: string;
  branchName: string;
  amount: number;
}

export interface FinancialTransaction {
  id: string;
  reference: string;
  patientName: string;
  date: string;
  method: string;
  amount: number;
}

export interface FinancialReportPayload {
  summary: FinancialSummary;
  doctorRevenue: FinancialRevenueByDoctor[];
  branchRevenue: FinancialRevenueByBranch[];
  recentTransactions: FinancialTransaction[];
}

export interface ApiDepartmentOption {
  value: Department;
  labelEn: string;
  labelAr: string;
}


export interface AccessLinkResponse {
  token: string;
  expiresAt: string;
  userId: string;
  email: string;
}

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

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

export const clearAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

const setStoredUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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

  if (response.status === 204) {
    return undefined as T;
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
    assignedBranches: apiUser.assignedBranches ?? fallbackUser?.assignedBranches ?? [],
    specialty: fallbackUser?.specialty,
    consultationFee: fallbackUser?.consultationFee,
    schedule: apiUser.schedule ?? fallbackUser?.schedule,
    activeBranchId: apiUser.activeBranchId ?? undefined,
    avatarUrl: fallbackUser?.avatarUrl,
  };
};

const normalizeDoctor = (doctor: ApiDoctor): User => ({
  id: doctor.id,
  name: doctor.name,
  email: doctor.email,
  phone: doctor.phone,
  role: UserRole.DOCTOR,
  specialty: doctor.specialty,
  consultationFee: doctor.consultationFee,
  assignedBranches: doctor.assignedBranches ?? [],
  schedule: doctor.schedule ?? [],
  payroll: doctor.payroll,
  status: 'ACTIVE',
});


const normalizeEmployee = (employee: ApiEmployee): User => ({
  id: employee.id,
  name: employee.name,
  email: employee.email,
  phone: employee.phone,
  role: employee.role,
  jobTitle: employee.jobTitle,
  assignedBranches: employee.assignedBranches ?? [],
  schedule: employee.schedule ?? [],
  payroll: employee.payroll,
  status: 'ACTIVE',
} as User);

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

const normalizeAppointment = (appointment: ApiAppointment, patients: Patient[] = []): Appointment => {
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
  const user = normalizeUser(response.user);
  setStoredUser(user);

  return user;
};

export const getCurrentUser = async (): Promise<User> => {
  const token = getToken();
  if (!token) throw new Error('No token found');

  const response = await apiFetch<{ user: ApiUser; clinicId: string }>('/auth/me');
  const user = normalizeUser(response.user);
  setStoredUser(user);

  return user;
};

export const getBranchesFromApi = async (): Promise<Branch[]> => {
  const payload = await apiFetch<{ data: ApiBranch[] }>('/branches');
  return (payload.data ?? []).map((branch) => ({
    id: branch.id,
    name: branch.name,
    location: branch.location,
    contactPhone: branch.contactPhone,
    isActive: branch.isActive,
  }));
};

export const getDepartmentsFromApi = async (): Promise<ApiDepartmentOption[]> => {
  const payload = await apiFetch<{ data: ApiDepartmentOption[] }>('/departments');
  return payload.data ?? [];
};


export const createBranchViaApi = async (branch: Omit<Branch, 'id'>): Promise<Branch> => {
  const payload = await apiFetch<ApiBranch>('/branches', {
    method: 'POST',
    body: JSON.stringify(branch),
  });

  return {
    id: payload.id,
    name: payload.name,
    location: payload.location,
    contactPhone: payload.contactPhone,
    isActive: payload.isActive,
  };
};

export const updateBranchViaApi = async (branch: Branch): Promise<Branch> => {
  const payload = await apiFetch<ApiBranch>(`/branches/${branch.id}`, {
    method: 'PUT',
    body: JSON.stringify(branch),
  });

  return {
    id: payload.id,
    name: payload.name,
    location: payload.location,
    contactPhone: payload.contactPhone,
    isActive: payload.isActive,
  };
};

export const deleteBranchViaApi = async (branchId: string): Promise<void> => {
  await apiFetch(`/branches/${branchId}`, {
    method: 'DELETE',
  });
};

export const getDoctorsFromApi = async (params?: { branchId?: string; specialty?: string; name?: string }): Promise<User[]> => {
  const query = new URLSearchParams();
  if (params?.branchId) query.set('branchId', params.branchId);
  if (params?.specialty) query.set('specialty', params.specialty);
  if (params?.name) query.set('name', params.name);

  const payload = await apiFetch<{ data: ApiDoctor[] }>(`/doctors${query.toString() ? `?${query.toString()}` : ''}`);
  return (payload.data ?? []).map(normalizeDoctor);
};

export const createDoctorViaApi = async (doctor: User): Promise<User> => {
  const payload = await apiFetch<ApiDoctor>('/doctors', {
    method: 'POST',
    body: JSON.stringify(doctor),
  });
  return normalizeDoctor(payload);
};

export const updateDoctorViaApi = async (doctor: User): Promise<User> => {
  const payload = await apiFetch<ApiDoctor>(`/doctors/${doctor.id}`, {
    method: 'PUT',
    body: JSON.stringify(doctor),
  });
  return normalizeDoctor(payload);
};

export const getRolesFromApi = async (): Promise<ApiRoleOption[]> => {
  const payload = await apiFetch<{ data: string[] }>('/roles');
  return (payload.data ?? []).map((roleName) => ({ value: roleName as UserRole, label: roleName }));
};

export const getEmployeesFromApi = async (params?: { branchId?: string; role?: string; name?: string }): Promise<User[]> => {
  const query = new URLSearchParams();
  if (params?.branchId) query.set('branchId', params.branchId);
  if (params?.role) query.set('role', params.role);
  if (params?.name) query.set('name', params.name);

  const payload = await apiFetch<{ data: ApiEmployee[] }>(`/employees${query.toString() ? `?${query.toString()}` : ''}`);
  return (payload.data ?? []).map(normalizeEmployee);
};

export const createEmployeeViaApi = async (employee: User): Promise<User> => {
  const payload = await apiFetch<ApiEmployee>('/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  });
  return normalizeEmployee(payload);
};

export const updateEmployeeViaApi = async (employee: User): Promise<User> => {
  const payload = await apiFetch<ApiEmployee>(`/employees/${employee.id}`, {
    method: 'PUT',
    body: JSON.stringify(employee),
  });
  return normalizeEmployee(payload);
};


export const lookupPatientsByPhoneFromApi = async (phone: string): Promise<Patient[]> => {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) return [];

  const cached = patientLookupCache.get(normalizedPhone);
  if (cached && Date.now() - cached.ts < 30_000) {
    return cached.data;
  }

  const query = new URLSearchParams({ phone: normalizedPhone });
  const payload = await apiFetch<{ data: ApiPatient[] }>(`/patients?${query.toString()}`);
  const patients = (payload.data ?? []).map(normalizePatient);

  patientLookupCache.set(normalizedPhone, { ts: Date.now(), data: patients });

  return patients;
};

export const createPatientViaApi = async (patient: Pick<Patient, 'name' | 'phone' | 'age' | 'gender'> & { medicalHistorySummary?: string }): Promise<Patient> => {
  const payload = await apiFetch<ApiPatient>('/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  });

  return normalizePatient(payload);
};


export const getAvailableSlotsBulkFromApi = async (params: { doctorIds: string[]; branchId: string; date: string }): Promise<Record<string, { time: string; available: boolean }[]>> => {
  const payload = await apiFetch<{ data: Record<string, { time: string; available: boolean }[]> }>('/appointments/available-slots/bulk', {
    method: 'POST',
    body: JSON.stringify({
      doctorIds: params.doctorIds.map((id) => Number(id)),
      branchId: Number(params.branchId),
      date: params.date,
    }),
  });

  return payload.data ?? {};
};

export const getAvailableSlotsFromApi = async (params: { doctorId: string; branchId: string; date: string }): Promise<{ time: string; available: boolean }[]> => {
  const query = new URLSearchParams({
    doctorId: params.doctorId,
    branchId: params.branchId,
    date: params.date,
  });

  const payload = await apiFetch<{ data: { time: string; available: boolean }[] }>(`/appointments/available-slots?${query.toString()}`);
  return payload.data ?? [];
};

export const getPatientsFromApi = async (): Promise<Patient[]> => {
  const payload = await apiFetch<{ data: ApiPatient[] }>('/patients');
  return (payload.data ?? []).map(normalizePatient);
};

export const getAppointmentsFromApi = async (patients: Patient[] = []): Promise<Appointment[]> => {
  const payload = await apiFetch<{ data: ApiAppointment[] }>('/appointments');
  return (payload.data ?? []).map((apt) => normalizeAppointment(apt, patients));
};

export const createAppointmentViaApi = async (appointment: Partial<Appointment>): Promise<ApiAppointment> => {
  if (!appointment.patientId || !appointment.doctorId || !appointment.branchId || !appointment.date || !appointment.timeSlot) {
    throw new Error('Incomplete appointment payload');
  }

  const patientId = Number(appointment.patientId);
  const doctorId = Number(appointment.doctorId);
  const branchId = Number(appointment.branchId);

  if ([patientId, doctorId, branchId].some(Number.isNaN)) {
    throw new Error('Booking requires backend-synced patient/doctor/branch IDs.');
  }

  return apiFetch<ApiAppointment>('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      patientId,
      doctorId,
      branchId,
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

export const getFinancialReportFromApi = async (params?: { from?: string; to?: string }): Promise<FinancialReportPayload> => {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);

  const payload = await apiFetch<{ data: FinancialReportPayload }>(`/reports/financial${query.toString() ? `?${query.toString()}` : ''}`);
  return payload.data;
};

export const getClinicSettingsFromApi = async (): Promise<ClinicSettingsPayload> => {
  const payload = await apiFetch<{ data: ClinicSettingsPayload }>('/clinic/settings');
  return payload.data;
};

export const updateClinicSettingsViaApi = async (settings: ClinicSettingsPayload): Promise<ClinicSettingsPayload> => {
  const payload = await apiFetch<{ data: ClinicSettingsPayload }>('/clinic/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

  return payload.data;
};


export const createAccessLinkViaApi = async (userId: string): Promise<AccessLinkResponse> => {
  const numericId = Number(userId);
  if (Number.isNaN(numericId)) {
    throw new Error('User must be synced with backend before generating access links.');
  }

  return apiFetch<AccessLinkResponse>('/auth/access-links', {
    method: 'POST',
    body: JSON.stringify({ userId: numericId }),
  });
};

export const consumeAccessLinkViaApi = async (payload: { token: string; email: string; password: string }): Promise<void> => {
  await apiFetch('/auth/access-links/consume', {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      email: payload.email,
      password: payload.password,
      password_confirmation: payload.password,
    }),
  }, false);
};
