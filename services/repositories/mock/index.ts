import { DEPARTMENTS } from '../../../constants';
import { AppointmentStatus, Department, PaymentStatus, User, UserRole } from '../../../types';
import { generateTimeSlots } from '../../mockData';
import type { ApiAppointment, ApiDepartmentOption, ClinicSettingsPayload, DelayInsightResponse, DoctorProfilePayload, FinancialReportPayload, MedicalEncounterWithHistory, ReconciliationSummaryRecord, ReportExportPayload } from '../../api';
import type { Repositories } from '../contracts';
import { clinicDataStore } from '../../localStore/appointmentsStore';

const readPatients = () => clinicDataStore.getPatients();
const readAppointments = () => clinicDataStore.getAppointments();
const readBranches = () => clinicDataStore.getBranches();

export const mockRepositories: Repositories = {
  auth: {
    login: async (email: string) => {
      const users = clinicDataStore.getUsers();
      const user = users.find((u) => u.email === email) ?? users[0];
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
    createAccessLink: async (userId: string) => ({ token: `mock-${userId}`, expiresAt: new Date(Date.now() + 3600000).toISOString(), userId, email: clinicDataStore.getUsers().find(u => u.id === userId)?.email ?? '' }),
  },
  branches: {
    getBranches: async () => readBranches(),
    createBranch: async (branch) => {
      return clinicDataStore.createBranch(branch);
    },
    updateBranch: async (branch) => {
      return clinicDataStore.updateBranch(branch);
    },
    deleteBranch: async (branchId) => clinicDataStore.deleteBranch(branchId),
    getBranchSettings: async (branchId) => clinicDataStore.getBranchSettings(branchId),
    updateBranchSettings: async (branchId, settings) => clinicDataStore.updateBranchSettings(branchId, settings),
    resetBranchSettings: async (branchId) => clinicDataStore.resetBranchSettings(branchId),
  },
  doctors: {
    getDoctors: async () => clinicDataStore.getUsers().filter((u) => u.role === UserRole.DOCTOR),
    createDoctor: async (doctor) => {
      const created = { ...doctor, id: doctor.id || `u-${Date.now()}` };
      return clinicDataStore.saveUser(created);
    },
    updateDoctor: async (doctor) => clinicDataStore.saveUser(doctor),
    getDepartments: async () => DEPARTMENTS.map((value) => ({ value: value as Department, labelEn: value, labelAr: value } as ApiDepartmentOption)),
    getDoctorProfile: async () => ({ doctorId: 'u1', specialization: 'Cardiology' } as unknown as DoctorProfilePayload),
    updateDoctorProfile: async (payload) => payload,
    updateDoctorAdvancedMode: async (enabled) => ({ canUseAdvancedMode: enabled } as any),
  },
  appointments: {
    getPatients: async () => readPatients(),
    getAppointments: async () => readAppointments(),
    createPatient: async (patient) => clinicDataStore.createPatient(patient),
    lookupPatientsByPhone: async (phone, name) => readPatients().filter((p) => p.phone.includes(phone) && (!name || p.name.toLowerCase().includes(name.toLowerCase()))),
    getAvailableSlotsBulk: async ({ doctorIds, date }) => Object.fromEntries(doctorIds.map((id) => [id, generateTimeSlots(date, id)])),
    createAppointment: async (appointment) => {
      const created = clinicDataStore.createAppointment(appointment);
      return { id: created.id, patientId: created.patientId, doctorId: created.doctorId, branchId: created.branchId, date: created.date, timeSlot: created.timeSlot, status: created.status ?? AppointmentStatus.SCHEDULED, billing: { total: created.billing?.total ?? 0, paidAmount: created.billing?.paidAmount ?? 0, status: created.billing?.status ?? PaymentStatus.UNPAID } } as ApiAppointment;
    },
    startVisitNow: async (appointmentId) => {
      const updated = clinicDataStore.startVisitNow(appointmentId);
      return { id: appointmentId, status: updated?.status ?? AppointmentStatus.IN_PROGRESS, startedAt: updated?.startedAt } as ApiAppointment;
    },
    updateAppointmentStatus: async (appointmentId, status) => {
      const updated = clinicDataStore.updateAppointmentStatus(appointmentId, status);
      return { id: appointmentId, status: updated?.status ?? status } as ApiAppointment;
    },
    addBillingItem: async (appointmentId) => ({ id: appointmentId } as ApiAppointment),
    processAppointmentPayment: async (appointmentId, payload) => {
      const updated = clinicDataStore.processAppointmentPayment(appointmentId, payload);
      return { id: appointmentId, billing: updated?.billing } as ApiAppointment;
    },
    removeBillingItem: async (appointmentId) => ({ id: appointmentId } as ApiAppointment),
    getMedicalEncounter: async () => ({ data: null, history: [] } as MedicalEncounterWithHistory),
    saveMedicalEncounter: async () => ({ id: `enc-${Date.now()}` } as any),
    getDelayInsight: async () => ({ showAlert: false, delayMinutes: 0, impactedCount: 0, suggestedShiftMinutes: 0, fromTime: null, preview: [], config: { graceMinutes: 5, thresholdMinutes: 15, roundingMinutes: 5, mode: 'manual' } } as DelayInsightResponse),
    previewShiftAppointments: async () => ({ showAlert: false, delayMinutes: 0, impactedCount: 0, suggestedShiftMinutes: 0, fromTime: null, preview: [], config: { graceMinutes: 5, thresholdMinutes: 15, roundingMinutes: 5, mode: 'manual' } } as DelayInsightResponse),
    shiftAppointments: async () => ({ shiftedAppointments: 0 }),
    getPatientAuditTimeline: async () => [],
  },
  settings: {
    getClinicSettings: async () => clinicDataStore.getClinicSettings(),
    updateClinicSettings: async (settings) => clinicDataStore.updateClinicSettings(settings),
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
