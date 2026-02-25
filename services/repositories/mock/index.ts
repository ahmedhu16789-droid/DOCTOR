import { BRANCHES, DEPARTMENTS, MOCK_USERS } from '../../../constants';
import { Appointment, AppointmentStatus, Branch, BranchOperationalSettings, BranchSettingsEnvelope, Department, Patient, PaymentStatus, User, UserRole } from '../../../types';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS, generateTimeSlots } from '../../mockData';
import type { ApiAppointment, ApiDepartmentOption, ClinicSettingsPayload, DelayInsightResponse, DoctorProfilePayload, FinancialReportPayload, MedicalEncounterWithHistory, ReconciliationSummaryRecord, ReportExportPayload } from '../../api';
import type { Repositories } from '../contracts';

const getLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};
const setLocal = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const keys = {
  patients: 'doctor:mock:patients:v1',
  appointments: 'doctor:mock:appointments:v1',
  branches: 'doctor:mock:branches:v1',
  branchSettings: 'doctor:mock:branch-settings:v1',
  clinicSettings: 'doctor:mock:clinic-settings:v1',
};

const readPatients = () => getLocal<Patient[]>(keys.patients, MOCK_PATIENTS);
const writePatients = (data: Patient[]) => setLocal(keys.patients, data);
const readAppointments = () => getLocal<Appointment[]>(keys.appointments, MOCK_APPOINTMENTS);
const writeAppointments = (data: Appointment[]) => setLocal(keys.appointments, data);
const readBranches = () => getLocal<Branch[]>(keys.branches, BRANCHES);

const defaultClinicSettings: ClinicSettingsPayload = {
  name: 'Al-Fath Clinic', email: 'info@alfath.com', phone: '0100000000', website: '', timezone: 'Africa/Cairo', currency: 'EGP', logoUrl: '',
  commission_basis: 'PAID_AMOUNT', apply_on_discounted_amount: true, include_tax: false, clawback_on_refund: true, accrual_day_of_month: 1,
  tv_queue_display_mode: 'FULL_NAME', doctor_advanced_mode_enabled: false,
};

export const mockRepositories: Repositories = {
  auth: {
    login: async (email: string) => {
      const user = MOCK_USERS.find((u) => u.email === email) ?? MOCK_USERS[0];
      localStorage.setItem('doctor:user', JSON.stringify(user));
      return user;
    },
    getCurrentUser: async () => {
      const raw = localStorage.getItem('doctor:user');
      if (!raw) throw new Error('Unauthenticated');
      return JSON.parse(raw) as User;
    },
    clearAuthToken: () => localStorage.removeItem('doctor:user'),
    consumeAccessLink: async () => {},
    createAccessLink: async (userId: string) => ({ token: `mock-${userId}`, expiresAt: new Date(Date.now() + 3600000).toISOString(), userId, email: MOCK_USERS.find(u => u.id === userId)?.email ?? '' }),
  },
  branches: {
    getBranches: async () => readBranches(),
    createBranch: async (branch) => {
      const created: Branch = { ...branch, id: `b-${Date.now()}` };
      const all = [...readBranches(), created];
      setLocal(keys.branches, all);
      return created;
    },
    updateBranch: async (branch) => {
      const all = readBranches().map((b) => b.id === branch.id ? branch : b);
      setLocal(keys.branches, all);
      return branch;
    },
    deleteBranch: async (branchId) => setLocal(keys.branches, readBranches().filter((b) => b.id !== branchId)),
    getBranchSettings: async (branchId) => getLocal<Record<string, BranchSettingsEnvelope>>(keys.branchSettings, {})[branchId] ?? { operational: { allowOverbooking: false, queueAlertsEnabled: true, queueAlertThresholdMinutes: 15, autoCompleteAfterMinutes: 30, telemedicineEnabled: false } },
    updateBranchSettings: async (branchId, settings) => {
      const map = getLocal<Record<string, BranchSettingsEnvelope>>(keys.branchSettings, {});
      map[branchId] = { operational: settings as BranchOperationalSettings };
      setLocal(keys.branchSettings, map);
      return map[branchId];
    },
    resetBranchSettings: async (branchId) => {
      const map = getLocal<Record<string, BranchSettingsEnvelope>>(keys.branchSettings, {});
      delete map[branchId];
      setLocal(keys.branchSettings, map);
      return { operational: { allowOverbooking: false, queueAlertsEnabled: true, queueAlertThresholdMinutes: 15, autoCompleteAfterMinutes: 30, telemedicineEnabled: false } };
    },
  },
  doctors: {
    getDoctors: async () => MOCK_USERS.filter((u) => u.role === UserRole.DOCTOR),
    createDoctor: async (doctor) => ({ ...doctor, id: `u-${Date.now()}` }),
    updateDoctor: async (doctor) => doctor,
    getDepartments: async () => DEPARTMENTS.map((value) => ({ value: value as Department, labelEn: value, labelAr: value } as ApiDepartmentOption)),
    getDoctorProfile: async () => ({ doctorId: 'u1', specialization: 'Cardiology' } as unknown as DoctorProfilePayload),
    updateDoctorProfile: async (payload) => payload,
    updateDoctorAdvancedMode: async (enabled) => ({ canUseAdvancedMode: enabled } as any),
  },
  appointments: {
    getPatients: async () => readPatients(),
    getAppointments: async () => readAppointments(),
    createPatient: async (patient) => {
      const created: Patient = { ...patient, id: `p-${Date.now()}`, balance: 0, medicalHistorySummary: patient.medicalHistorySummary ?? 'New Patient' };
      const all = [...readPatients(), created];
      writePatients(all);
      return created;
    },
    lookupPatientsByPhone: async (phone, name) => readPatients().filter((p) => p.phone.includes(phone) && (!name || p.name.toLowerCase().includes(name.toLowerCase()))),
    getAvailableSlotsBulk: async ({ doctorIds, date }) => Object.fromEntries(doctorIds.map((id) => [id, generateTimeSlots(date, id)])),
    createAppointment: async (appointment) => {
      const created: Appointment = { ...appointment, id: `apt-${Date.now()}` } as Appointment;
      const all = [...readAppointments(), created];
      writeAppointments(all);
      return { id: created.id, patientId: created.patientId, doctorId: created.doctorId, branchId: created.branchId, date: created.date, timeSlot: created.timeSlot, status: created.status ?? AppointmentStatus.SCHEDULED, billing: { total: created.billing?.total ?? 0, paidAmount: created.billing?.paidAmount ?? 0, status: created.billing?.status ?? PaymentStatus.UNPAID } } as ApiAppointment;
    },
    startVisitNow: async (appointmentId) => ({ id: appointmentId } as ApiAppointment),
    updateAppointmentStatus: async (appointmentId, status) => {
      const all = readAppointments().map((a) => a.id === appointmentId ? { ...a, status } : a);
      writeAppointments(all);
      return { id: appointmentId, status } as ApiAppointment;
    },
    addBillingItem: async (appointmentId) => ({ id: appointmentId } as ApiAppointment),
    processAppointmentPayment: async (appointmentId) => ({ id: appointmentId } as ApiAppointment),
    removeBillingItem: async (appointmentId) => ({ id: appointmentId } as ApiAppointment),
    getMedicalEncounter: async () => ({ data: null, history: [] } as MedicalEncounterWithHistory),
    saveMedicalEncounter: async () => ({ id: `enc-${Date.now()}` } as any),
    getDelayInsight: async () => ({ showAlert: false, delayMinutes: 0, impactedCount: 0, suggestedShiftMinutes: 0, fromTime: null, preview: [], config: { graceMinutes: 5, thresholdMinutes: 15, roundingMinutes: 5, mode: 'manual' } } as DelayInsightResponse),
    previewShiftAppointments: async () => ({ showAlert: false, delayMinutes: 0, impactedCount: 0, suggestedShiftMinutes: 0, fromTime: null, preview: [], config: { graceMinutes: 5, thresholdMinutes: 15, roundingMinutes: 5, mode: 'manual' } } as DelayInsightResponse),
    shiftAppointments: async () => ({ shiftedAppointments: 0 }),
    getPatientAuditTimeline: async () => [],
  },
  settings: {
    getClinicSettings: async () => getLocal(keys.clinicSettings, defaultClinicSettings),
    updateClinicSettings: async (settings) => {
      setLocal(keys.clinicSettings, settings);
      return settings;
    },
  },
  reports: {
    getFinancialReport: async () => ({ summary: { totalRevenue: 0, totalExpenses: 0, netProfit: 0 }, dailyBreakdown: [] } as unknown as FinancialReportPayload),
    exportFinancialReportCsv: async () => ({ filename: 'financial-report.csv', content: '' } as ReportExportPayload),
    getReconciliationReport: async () => [] as ReconciliationSummaryRecord[],
    getDoctorPayrollReport: async () => [],
    exportDoctorPayrollReportCsv: async () => ({ filename: 'doctor-payroll.csv', content: '' } as ReportExportPayload),
    closeDoctorPayrollPeriod: async () => {},
    settleDoctorPayrollPeriod: async () => {},
  },
};
