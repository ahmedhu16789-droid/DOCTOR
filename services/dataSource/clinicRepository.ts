import { BRANCHES, DEPARTMENTS, MOCK_USERS } from '../../constants';
import { Appointment, AppointmentStatus, Branch, Department, Employee, Patient, PaymentMethod, PaymentStatus, TimeSlot, User, UserRole } from '../../types';
import { addBillingItemViaApi, ApiDepartmentOption, ApiRoleOption, clearAuthToken, createAccessLinkViaApi, createAppointmentViaApi, createDoctorViaApi, createEmployeeViaApi, createPatientViaApi, getAppointmentsFromApi, getAvailableSlotsBulkFromApi, getAvailableSlotsFromApi, getBranchesFromApi, getCurrentUser, getDepartmentsFromApi, getDoctorsFromApi, getEmployeesFromApi, getPatientsFromApi, getRolesFromApi, loginWithApi, lookupPatientsByPhoneFromApi, processAppointmentPaymentViaApi, removeBillingItemViaApi, updateAppointmentStatusViaApi, updateDoctorViaApi, updateEmployeeViaApi } from '../api';
import { MOCK_APPOINTMENTS, MOCK_EMPLOYEES, MOCK_PATIENTS, generateTimeSlots } from '../mockData';
import { getStoredUser, setStoredUser } from '../core/authSession';

export type DataMode = 'api' | 'mock' | 'hybrid';

const DATA_MODE = ((import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? 'hybrid');

export const getDataMode = (): DataMode => DATA_MODE;

interface DoctorFilters {
  branchId?: string;
  specialty?: string;
  name?: string;
}

interface EmployeeFilters {
  branchId?: string;
  role?: string;
  name?: string;
}

const mockState = {
  patients: [...MOCK_PATIENTS],
  appointments: [...MOCK_APPOINTMENTS],
  doctors: MOCK_USERS.filter((user) => user.role === UserRole.DOCTOR),
  employees: [...MOCK_EMPLOYEES],
  branches: [...BRANCHES],
};

const createId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const resolvePaymentStatus = (paidAmount: number, total: number): PaymentStatus => {
  if (paidAmount <= 0) return PaymentStatus.UNPAID;
  if (paidAmount >= total) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
};

async function withMode<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
  if (DATA_MODE === 'mock') return mockFn();
  if (DATA_MODE === 'api') return apiFn();

  try {
    return await apiFn();
  } catch {
    return mockFn();
  }
}

export const clinicRepository = {
  dataMode: DATA_MODE,

  login: (email: string, password: string): Promise<User> => withMode(
    () => loginWithApi(email, password),
    async () => {
      const user = MOCK_USERS.find((candidate) => candidate.email === email) ?? MOCK_USERS[0];
      setStoredUser(user);
      return user;
    },
  ),

  getCurrentUser: (): Promise<User> => withMode(
    () => getCurrentUser(),
    async () => {
      const user = getStoredUser();
      if (!user) {
        throw new Error('No active user session');
      }
      return user;
    },
  ),

  clearAuth: (): void => {
    clearAuthToken();
  },

  lookupPatientsByPhone: (phone: string): Promise<Patient[]> => withMode(
    () => lookupPatientsByPhoneFromApi(phone),
    async () => mockState.patients.filter((patient) => patient.phone.includes(phone)),
  ),

  createPatient: (patient: Pick<Patient, 'name' | 'phone' | 'age' | 'gender'> & { medicalHistorySummary?: string }): Promise<Patient> => withMode(
    () => createPatientViaApi(patient),
    async () => {
      const created: Patient = {
        id: createId('p'),
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        medicalHistorySummary: patient.medicalHistorySummary ?? '',
        lastVisit: '',
        balance: 0,
      };
      mockState.patients = [created, ...mockState.patients];
      return created;
    },
  ),

  getPatients: (): Promise<Patient[]> => withMode(
    () => getPatientsFromApi(),
    async () => mockState.patients,
  ),

  getDoctors: (params?: DoctorFilters): Promise<User[]> => withMode(
    () => getDoctorsFromApi(params),
    async () => mockState.doctors.filter((doctor) => {
      if (params?.branchId && !doctor.assignedBranches.includes(params.branchId)) return false;
      if (params?.specialty && doctor.specialty !== params.specialty) return false;
      if (params?.name && !doctor.name.toLowerCase().includes(params.name.toLowerCase())) return false;
      return true;
    }),
  ),

  getAvailableSlots: (params: { doctorId: string; branchId: string; date: string }): Promise<TimeSlot[]> => withMode(
    () => getAvailableSlotsFromApi(params),
    async () => generateTimeSlots(params.date, params.doctorId),
  ),

  getAvailableSlotsBulk: (params: { doctorIds: string[]; branchId: string; date: string }): Promise<Record<string, TimeSlot[]>> => withMode(
    () => getAvailableSlotsBulkFromApi(params),
    async () => params.doctorIds.reduce<Record<string, TimeSlot[]>>((acc, doctorId) => {
      acc[doctorId] = generateTimeSlots(params.date, doctorId);
      return acc;
    }, {}),
  ),

  getAppointments: (patients: Patient[] = [], params?: { date?: string }): Promise<Appointment[]> => withMode(
    () => getAppointmentsFromApi(patients, params),
    async () => {
      if (!params?.date) return mockState.appointments;
      return mockState.appointments.filter((appointment) => appointment.date === params.date);
    },
  ),

  createAppointment: (appointment: Partial<Appointment>) => withMode(
    () => createAppointmentViaApi(appointment),
    async () => {
      const created: Appointment = {
        ...(appointment as Appointment),
        id: appointment.id ?? createId('apt'),
      };
      mockState.appointments = [created, ...mockState.appointments];
      return created;
    },
  ),

  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => withMode(
    () => updateAppointmentStatusViaApi(appointmentId, status),
    async () => {
      const target = mockState.appointments.find((appointment) => appointment.id === appointmentId);
      if (!target) throw new Error('Appointment not found');
      target.status = status;
      return target;
    },
  ),

  addBillingItem: (appointmentId: string, service: { serviceId?: string; name: string; category?: string; quantity?: number; unitPrice: number }) => withMode(
    () => addBillingItemViaApi(appointmentId, service),
    async () => {
      const target = mockState.appointments.find((appointment) => appointment.id === appointmentId);
      if (!target) throw new Error('Appointment not found');
      const quantity = service.quantity ?? 1;
      const total = quantity * service.unitPrice;
      target.billing.items.push({
        id: createId('item'),
        serviceId: service.serviceId ?? '',
        name: service.name,
        quantity,
        unitPrice: service.unitPrice,
        total,
        addedBy: 'system',
        timestamp: new Date().toISOString(),
      });
      target.billing.total += total;
      target.billing.subtotal = target.billing.total;
      target.billing.status = resolvePaymentStatus(target.billing.paidAmount, target.billing.total);
      return target;
    },
  ),

  removeBillingItem: (appointmentId: string, itemId: string) => withMode(
    () => removeBillingItemViaApi(appointmentId, itemId),
    async () => {
      const target = mockState.appointments.find((appointment) => appointment.id === appointmentId);
      if (!target) throw new Error('Appointment not found');
      target.billing.items = target.billing.items.filter((item) => item.id !== itemId);
      target.billing.total = target.billing.items.reduce((sum, item) => sum + item.total, 0);
      target.billing.subtotal = target.billing.total;
      target.billing.status = resolvePaymentStatus(target.billing.paidAmount, target.billing.total);
      return target;
    },
  ),

  processAppointmentPayment: (appointmentId: string, payload: { amount: number; method: PaymentMethod }) => withMode(
    () => processAppointmentPaymentViaApi(appointmentId, payload),
    async () => {
      const target = mockState.appointments.find((appointment) => appointment.id === appointmentId);
      if (!target) throw new Error('Appointment not found');
      target.billing.paidAmount += payload.amount;
      target.billing.status = resolvePaymentStatus(target.billing.paidAmount, target.billing.total);
      return target;
    },
  ),

  getBranches: (signal?: AbortSignal): Promise<Branch[]> => withMode(
    () => getBranchesFromApi(signal),
    async () => mockState.branches,
  ),

  getDepartments: (): Promise<ApiDepartmentOption[]> => withMode(
    () => getDepartmentsFromApi(),
    async () => DEPARTMENTS.map((department) => ({ value: department as Department, labelAr: department, labelEn: department })),
  ),

  createDoctor: (doctor: User): Promise<User> => withMode(
    () => createDoctorViaApi(doctor),
    async () => {
      const created = { ...doctor, id: createId('u') };
      mockState.doctors = [...mockState.doctors, created];
      return created;
    },
  ),

  updateDoctor: (doctor: User): Promise<User> => withMode(
    () => updateDoctorViaApi(doctor),
    async () => {
      mockState.doctors = mockState.doctors.map((item) => item.id === doctor.id ? doctor : item);
      return doctor;
    },
  ),

  getEmployees: (params?: EmployeeFilters): Promise<User[]> => withMode(
    () => getEmployeesFromApi(params),
    async () => mockState.employees.filter((employee) => {
      if (params?.branchId && !employee.assignedBranches.includes(params.branchId)) return false;
      if (params?.role && employee.role !== params.role) return false;
      if (params?.name && !employee.name.toLowerCase().includes(params.name.toLowerCase())) return false;
      return true;
    }),
  ),

  createEmployee: (employee: User): Promise<User> => withMode(
    () => createEmployeeViaApi(employee),
    async () => {
      const created = { ...employee, id: createId('e') } as Employee;
      mockState.employees = [...mockState.employees, created];
      return created;
    },
  ),

  updateEmployee: (employee: User): Promise<User> => withMode(
    () => updateEmployeeViaApi(employee),
    async () => {
      mockState.employees = mockState.employees.map((item) => item.id === employee.id ? employee as Employee : item);
      return employee;
    },
  ),

  getRoles: (): Promise<ApiRoleOption[]> => withMode(
    () => getRolesFromApi(),
    async () => Object.values(UserRole).map((role) => ({ value: role, label: role })),
  ),

  createAccessLink: (userId: string) => withMode(
    () => createAccessLinkViaApi(userId),
    async () => ({ token: createId('link'), expires_at: new Date(Date.now() + 3600_000).toISOString() }),
  ),
};

export type { ApiDepartmentOption, ApiRoleOption };
