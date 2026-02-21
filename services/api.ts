import { Appointment, AppointmentStatus, Branch, BranchOperationalSettings, BranchSettingsEnvelope, Department, Medication, Patient, PaymentEntry, PaymentMethod, PaymentStatus, User, UserRole, VitalSigns } from '../types';
import { MOCK_USERS } from '../constants';
import { apiFetch } from './core/httpClient';
import { clearAuthSession, getStoredUser, setStoredUser, setToken } from './core/authSession';

const patientLookupCache = new Map<string, { ts: number; data: Patient[] }>();
const doctorsCache = new Map<string, { ts: number; data: User[] }>();
const slotsBulkCache = new Map<string, { ts: number; data: Record<string, { time: string; available: boolean }[]> }>();

interface ApiUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  assignedBranches?: string[];
  schedule?: User['schedule'];
  activeBranchId?: string | null;
  examFindingTemplates?: string[];
  diagnosisTemplates?: string[];
  planTemplates?: string[];
}

interface ApiLoginResponse {
  token?: string;
  user: ApiUser;
  clinicId: string;
}

interface ApiAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  branchId: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  scheduledStartAt?: string | null;
  checkInAt?: string | null;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  noShowAt?: string | null;
  queueMetrics?: {
    waitingMinutes?: number | null;
    serviceMinutes?: number | null;
    delayMinutes?: number | null;
  };
  billing: {
    total: number;
    paidAmount: number;
    status: PaymentStatus;
    items?: {
      id: string;
      serviceId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
    transactions?: {
      id: string;
      amount: number;
      method: PaymentMethod;
      timestamp: string;
      recordedBy: string;
      reference?: string;
      type: 'PAYMENT' | 'REFUND';
    }[];
  };
}


interface ApiBulkShiftResponse {
  shiftedAppointments: number;
  doctorId: string;
  branchId: string;
  date: string;
  fromTime: string;
  shiftMinutes: number;
}

interface ApiMedicalEncounter {
  id: string;
  appointmentId: string;
  vitals?: VitalSigns;
  examFindings?: string;
  diagnosis?: string;
  plan?: string;
  nextVisitDate?: string;
  nextVisitType?: string;
  nextVisitInterval?: number;
  status: 'DRAFT' | 'FINALIZED';
  date?: string;
  timeSlot?: string;
  prescription: {
    id: string;
    name: string;
    activeIngredient?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }[];
}


interface ApiEncounterHistoryResponse {
  data: ApiMedicalEncounter | null;
  history?: ApiMedicalEncounter[];
}

export interface MedicalEncounterWithHistory {
  data: ApiMedicalEncounter | null;
  history: ApiMedicalEncounter[];
}

interface ApiPatient {
  id: string;
  name: string;
  phone: string;
  gender: 'Male' | 'Female';
  age: number;
  medicalHistorySummary: string;
  lastVisit?: string | null;
  duplicateHint?: {
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    nameSimilarity: number;
    phoneExact: boolean;
  };
}

interface ApiBranch {
  id: string;
  name: string;
  location: string;
  contactPhone: string;
  isActive: boolean;
  settings?: BranchSettingsEnvelope;
}

interface ApiDataEnvelope<T> {
  data: T;
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
  examFindingTemplates?: string[];
  diagnosisTemplates?: string[];
  planTemplates?: string[];
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
  commission_basis: 'PAID_AMOUNT' | 'INVOICE_TOTAL';
  apply_on_discounted_amount: boolean;
  include_tax: boolean;
  clawback_on_refund: boolean;
  accrual_day_of_month: number;
  tv_queue_display_mode: 'FULL_NAME' | 'MASKED_NAME';
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

export interface DoctorPayrollReportFilters {
  doctorId?: string;
  branchId?: string;
  periodMonth?: string;
  status?: string;
}

export interface DoctorPayrollReportRecord {
  periodId: string;
  doctorId: string;
  doctorName: string;
  periodMonth: string;
  totalEarned: number;
  totalAdjustments: number;
  totalSettled: number;
  status: 'OPEN' | 'CLOSED' | 'SETTLED';
  closedAt?: string | null;
  periodEnded?: boolean;
  canSettle?: boolean;
  commissionDetails?: {
    consultationBasis: number;
    consultationAmount: number;
    consultationRate: number | null;
    servicesBasis: number;
    servicesAmount: number;
    servicesRate: number | null;
  };
  settlements?: {
    id: string;
    settlementDate: string;
    amount: number;
    settlementKind: 'PARTIAL' | 'FINAL';
    method: string;
    reference?: string | null;
  }[];
}

export interface DoctorPayrollSettlementPayload {
  settlement_date: string;
  amount: number;
  method: string;
  reference?: string;
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

export type DataSourceMode = 'api' | 'mock' | 'hybrid';

type AppointmentEntityKind = 'patient' | 'doctor' | 'branch';

export interface AppointmentEntityIdMap {
  patient?: Record<string, string>;
  doctor?: Record<string, string>;
  branch?: Record<string, string>;
}

export interface CreateAppointmentContext {
  dataSourceMode?: DataSourceMode;
  entityIdMap?: AppointmentEntityIdMap;
}

export { getStoredUser };

export const clearAuthToken = (): void => {
  clearAuthSession();
};

const normalizeUser = (apiUser: ApiUser, fallbackUser?: User | null): User => {
  // If fallbackUser is not provided, try to find it from MOCK_USERS
  const effectiveFallbackUser = fallbackUser === undefined
    ? MOCK_USERS.find((u) => u.id === apiUser.id || u.email === apiUser.email)
    : fallbackUser;

  return {
    id: String(apiUser.id),
    name: apiUser.name,
    role: apiUser.role,
    email: apiUser.email,
    assignedBranches: apiUser.assignedBranches ?? fallbackUser?.assignedBranches ?? [],
    specialty: fallbackUser?.specialty,
    consultationFee: fallbackUser?.consultationFee,
    schedule: apiUser.schedule ?? fallbackUser?.schedule,
    activeBranchId: apiUser.activeBranchId ?? undefined,
    avatarUrl: fallbackUser?.avatarUrl,
    examFindingTemplates: apiUser.examFindingTemplates ?? fallbackUser?.examFindingTemplates ?? [],
    diagnosisTemplates: apiUser.diagnosisTemplates ?? fallbackUser?.diagnosisTemplates ?? [],
    planTemplates: apiUser.planTemplates ?? fallbackUser?.planTemplates ?? [],
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
  examFindingTemplates: doctor.examFindingTemplates ?? [],
  diagnosisTemplates: doctor.diagnosisTemplates ?? [],
  planTemplates: doctor.planTemplates ?? [],
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
  medicalHistorySummary: patient.medicalHistorySummary ?? 'New Patient',
  lastVisit: patient.lastVisit ?? '-',
  balance: 0,
  duplicateHint: patient.duplicateHint,
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
    doctorName: appointment.doctorName ?? doctor?.name ?? 'Doctor',
    branchId: appointment.branchId,
    date: appointment.date,
    timeSlot: appointment.timeSlot,
    department: doctor?.specialty ?? Department.INTERNAL_MEDICINE,
    status: appointment.status,
    type: mapAppointmentType(appointment.status),
    scheduledStartAt: appointment.scheduledStartAt,
    checkInAt: appointment.checkInAt,
    calledAt: appointment.calledAt,
    startedAt: appointment.startedAt,
    completedAt: appointment.completedAt,
    noShowAt: appointment.noShowAt,
    queueMetrics: appointment.queueMetrics,
    createdAt: new Date().toISOString(),
    billing: {
      items: (appointment.billing.items ?? []).map((item) => ({
        ...item,
        serviceId: item.serviceId ?? '',
        addedBy: 'system',
        timestamp: new Date().toISOString(),
      })),
      subtotal: appointment.billing.total,
      discount: 0,
      total: appointment.billing.total,
      paidAmount: appointment.billing.paidAmount,
      status: appointment.billing.status,
      transactions: appointment.billing.transactions ?? (appointment.billing.paidAmount > 0 ? [{
        id: `tx-${appointment.id}`,
        amount: appointment.billing.paidAmount,
        method: PaymentMethod.CASH,
        timestamp: new Date().toISOString(),
        recordedBy: 'system',
        type: 'PAYMENT'
      }] : []),
    },
  };
};

export const loginWithApi = async (email: string, password: string): Promise<User> => {
  const response = await apiFetch<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);

  if (response.token) {
    setToken(response.token);
  }

  const user = normalizeUser(response.user);
  setStoredUser(user);

  return user;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await apiFetch<{ user: ApiUser; clinicId: string }>('/auth/me');
  const user = normalizeUser(response.user);
  setStoredUser(user);

  return user;
};

export const getBranchesFromApi = async (signal?: AbortSignal): Promise<Branch[]> => {
  const payload = await apiFetch<{ data: ApiBranch[] }>('/branches', { signal });
  return (payload.data ?? []).map((branch) => ({
    id: String(branch.id),
    name: branch.name,
    location: branch.location,
    contactPhone: branch.contactPhone,
    isActive: branch.isActive,
    settings: branch.settings,
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
    settings: payload.settings,
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
    settings: payload.settings,
  };
};

export const getBranchSettingsFromApi = async (branchId: string): Promise<BranchSettingsEnvelope> => {
  const payload = await apiFetch<ApiDataEnvelope<BranchSettingsEnvelope>>(`/branches/${branchId}/settings`);

  return payload.data;
};

export const updateBranchSettingsViaApi = async (branchId: string, settings: BranchOperationalSettings): Promise<BranchSettingsEnvelope> => {
  const payload = await apiFetch<ApiDataEnvelope<BranchSettingsEnvelope>>(`/branches/${branchId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

  return payload.data;
};

export const resetBranchSettingsViaApi = async (branchId: string): Promise<BranchSettingsEnvelope> => {
  const payload = await apiFetch<ApiDataEnvelope<BranchSettingsEnvelope>>(`/branches/${branchId}/settings`, {
    method: 'DELETE',
  });

  return payload.data;
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

  const cacheKey = query.toString();
  const cached = doctorsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30_000) {
    return cached.data;
  }

  const payload = await apiFetch<{ data: ApiDoctor[] }>(`/doctors${query.toString() ? `?${query.toString()}` : ''}`);
  const doctors = (payload.data ?? []).map(normalizeDoctor);
  doctorsCache.set(cacheKey, { ts: Date.now(), data: doctors });

  return doctors;
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


export const lookupPatientsByPhoneFromApi = async (phone: string, name?: string): Promise<Patient[]> => {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) return [];

  const cacheKey = `${normalizedPhone}|${name?.trim().toLowerCase() ?? ''}`;
  const cached = patientLookupCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30_000) {
    return cached.data;
  }

  const query = new URLSearchParams({ phone: normalizedPhone });
  if (name?.trim()) {
    query.set('name', name.trim());
  }
  const payload = await apiFetch<{ data: ApiPatient[] }>(`/patients?${query.toString()}`);
  const patients = (payload.data ?? []).map(normalizePatient);

  patientLookupCache.set(cacheKey, { ts: Date.now(), data: patients });

  return patients;
};

export const createPatientViaApi = async (patient: Pick<Patient, 'name' | 'phone' | 'age' | 'gender'> & { medicalHistorySummary?: string }): Promise<Patient> => {
  const payload = await apiFetch<ApiPatient>('/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  });
  console.log('createPatientViaApi payload:', payload);

  return normalizePatient(payload);
};


export const getAvailableSlotsBulkFromApi = async (params: { doctorIds: string[]; branchId: string; date: string }): Promise<Record<string, { time: string; available: boolean }[]>> => {
  const sortedDoctorIds = [...params.doctorIds].sort();
  const cacheKey = `${params.branchId}|${params.date}|${sortedDoctorIds.join(',')}`;
  const cached = slotsBulkCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 20_000) {
    return cached.data;
  }

  const payload = await apiFetch<{ data: Record<string, { time: string; available: boolean }[]> }>('/appointments/available-slots/bulk', {
    method: 'POST',
    body: JSON.stringify({
      doctorIds: sortedDoctorIds.map((id) => Number(id)),
      branchId: Number(params.branchId),
      date: params.date,
    }),
  });

  const data = payload.data ?? {};
  slotsBulkCache.set(cacheKey, { ts: Date.now(), data });

  return data;
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

export const getAppointmentsFromApi = async (patients: Patient[] = [], params?: { date?: string }): Promise<Appointment[]> => {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  const payload = await apiFetch<{ data: ApiAppointment[] }>(`/appointments${query.toString() ? `?${query.toString()}` : ''}`);
  return (payload.data ?? []).map((apt) => normalizeAppointment(apt, patients));
};


export const shiftAppointmentsViaApi = async (params: {
  doctorId: string;
  branchId: string;
  date: string;
  fromTime: string;
  shiftMinutes: number;
}): Promise<ApiBulkShiftResponse> => {
  const payload = await apiFetch<{ data: ApiBulkShiftResponse }>('/appointments/shift', {
    method: 'POST',
    body: JSON.stringify({
      doctorId: Number(params.doctorId),
      branchId: Number(params.branchId),
      date: params.date,
      fromTime: params.fromTime,
      shiftMinutes: params.shiftMinutes,
    }),
  });

  slotsBulkCache.clear();

  return payload.data;
};

const toNumericEntityId = (
  kind: AppointmentEntityKind,
  rawId: string,
  mode: DataSourceMode,
  entityIdMap?: AppointmentEntityIdMap,
): number => {
  const normalizedRawId = String(rawId);
  const directNumericId = Number(normalizedRawId);

  if (!Number.isNaN(directNumericId)) {
    return directNumericId;
  }

  if (mode !== 'hybrid') {
    throw new Error('Booking requires backend-synced patient/doctor/branch IDs.');
  }

  const translatedId = entityIdMap?.[kind]?.[normalizedRawId];
  const translatedNumericId = Number(translatedId);

  if (translatedId === undefined || Number.isNaN(translatedNumericId)) {
    throw new Error(`Hybrid booking requires synced ${kind} IDs before API create.`);
  }

  return translatedNumericId;
};

export const createAppointmentViaApi = async (
  appointment: Partial<Appointment>,
  context: CreateAppointmentContext = {},
): Promise<ApiAppointment> => {
  const dataSourceMode = context.dataSourceMode ?? 'api';

  if (dataSourceMode === 'mock') {
    throw new Error('Skipping API booking because current data source is mock.');
  }

  if (!appointment.patientId || !appointment.doctorId || !appointment.branchId || !appointment.date || !appointment.timeSlot) {
    throw new Error('Incomplete appointment payload');
  }

  const patientId = toNumericEntityId('patient', appointment.patientId, dataSourceMode, context.entityIdMap);
  const doctorId = toNumericEntityId('doctor', appointment.doctorId, dataSourceMode, context.entityIdMap);
  const branchId = toNumericEntityId('branch', appointment.branchId, dataSourceMode, context.entityIdMap);

  const created = await apiFetch<ApiAppointment>('/appointments', {
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

  slotsBulkCache.clear();

  return created;
};


export const getMedicalEncounterFromApi = async (appointmentId: string): Promise<MedicalEncounterWithHistory> => {
  const payload = await apiFetch<ApiEncounterHistoryResponse>(`/appointments/${appointmentId}/encounter`);
  return {
    data: payload.data,
    history: payload.history ?? [],
  };
};

export const startVisitNowViaApi = async (appointmentId: string): Promise<ApiAppointment> => {
  const payload = await apiFetch<{ data: ApiAppointment }>(`/appointments/${appointmentId}/start-now`, {
    method: 'POST',
  });

  return payload.data;
};


export const updateAppointmentStatusViaApi = async (appointmentId: string, status: AppointmentStatus): Promise<ApiAppointment> => {
  const payload = await apiFetch<{ data: ApiAppointment }>(`/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  return payload.data;
};

export const saveMedicalEncounterViaApi = async (appointmentId: string, payload: {
  vitals?: VitalSigns;
  examFindings?: string;
  diagnosis?: string;
  plan?: string;
  nextVisitDate?: string;
  nextVisitType?: string;
  nextVisitInterval?: number;
  status?: 'DRAFT' | 'FINALIZED';
  prescription: Medication[];
}): Promise<ApiMedicalEncounter> => {
  const response = await apiFetch<{ data: ApiMedicalEncounter }>(`/appointments/${appointmentId}/encounter`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const searchMedicationsFromApi = async (search: string): Promise<{ id: string; name: string; activeIngredient?: string }[]> => {
  if (!search.trim()) return [];
  const query = new URLSearchParams({ search });
  const payload = await apiFetch<{ data: { id: string; name: string; activeIngredient?: string }[] }>(`/medications?${query.toString()}`);
  return payload.data ?? [];
};

export const addBillingItemViaApi = async (appointmentId: string, service: { serviceId?: string; name: string; category?: string; quantity?: number; unitPrice: number }): Promise<ApiAppointment> => {
  const payload = await apiFetch<{ data: ApiAppointment }>(`/appointments/${appointmentId}/billing/items`, {
    method: 'POST',
    body: JSON.stringify(service),
  });

  return payload.data;
};


export const processAppointmentPaymentViaApi = async (appointmentId: string, payload: { amount?: number; method?: PaymentMethod; payments?: PaymentEntry[] }): Promise<ApiAppointment> => {
  const response = await apiFetch<{ data: ApiAppointment }>(`/appointments/${appointmentId}/billing/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const removeBillingItemViaApi = async (appointmentId: string, itemId: string): Promise<ApiAppointment> => {
  const payload = await apiFetch<{ data: ApiAppointment }>(`/appointments/${appointmentId}/billing/items/${itemId}`, {
    method: 'DELETE',
  });

  return payload.data;
};

export const getFinancialReportFromApi = async (params?: { from?: string; to?: string }): Promise<FinancialReportPayload> => {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);

  const payload = await apiFetch<{ data: FinancialReportPayload }>(`/reports/financial${query.toString() ? `?${query.toString()}` : ''}`);
  return payload.data;
};

export const getDoctorPayrollReportFromApi = async (params?: DoctorPayrollReportFilters): Promise<DoctorPayrollReportRecord[]> => {
  const query = new URLSearchParams();
  if (params?.doctorId) query.set('doctor_id', params.doctorId);
  if (params?.branchId) query.set('branch_id', params.branchId);
  if (params?.periodMonth) query.set('period_month', params.periodMonth);
  if (params?.status) query.set('status', params.status);

  const payload = await apiFetch<{ data: DoctorPayrollReportRecord[] }>(`/reports/doctor-payroll${query.toString() ? `?${query.toString()}` : ''}`);
  return payload.data ?? [];
};

export const closeDoctorPayrollPeriod = async (periodId: string): Promise<void> => {
  await apiFetch(`/payroll/periods/${periodId}/close`, {
    method: 'POST',
  });
};

export const settleDoctorPayrollPeriod = async (periodId: string, payload: DoctorPayrollSettlementPayload): Promise<void> => {
  await apiFetch(`/payroll/periods/${periodId}/settle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};


export interface DoctorProfilePayload {
  examFindingTemplates: string[];
  diagnosisTemplates: string[];
  planTemplates: string[];
}

export const getDoctorProfileFromApi = async (): Promise<DoctorProfilePayload> => {
  return apiFetch<DoctorProfilePayload>('/doctor-profile');
};

export const updateDoctorProfileFromApi = async (payload: DoctorProfilePayload): Promise<DoctorProfilePayload> => {
  return apiFetch<DoctorProfilePayload>('/doctor-profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
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
