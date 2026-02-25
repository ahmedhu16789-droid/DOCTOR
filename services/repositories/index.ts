import { apiRepositories } from './api';
import { mockRepositories } from './mock';
import type { DataSourceMode, Repositories } from './contracts';

const MODE = String(import.meta.env.VITE_DATA_SOURCE_MODE ?? 'api').toLowerCase();
export const DATA_SOURCE_MODE: DataSourceMode = MODE === 'mock' || MODE === 'hybrid' ? MODE : 'api';

const queueKey = 'doctor:hybrid:write-queue:v1';
const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(queueKey) ?? '[]') as Array<{ domain: keyof Repositories; method: string; args: unknown[]; createdAt: string }>;
  } catch {
    return [];
  }
};
const pushQueue = (domain: keyof Repositories, method: string, args: unknown[]) => {
  const current = readQueue();
  current.push({ domain, method, args, createdAt: new Date().toISOString() });
  localStorage.setItem(queueKey, JSON.stringify(current));
};

const withReadFallback = <TArgs extends unknown[], TReturn>(apiFn: (...args: TArgs) => Promise<TReturn>, mockFn: (...args: TArgs) => Promise<TReturn>) => {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await apiFn(...args);
    } catch {
      return mockFn(...args);
    }
  };
};

const withQueuedWrite = <TArgs extends unknown[], TReturn>(domain: keyof Repositories, method: string, apiFn: (...args: TArgs) => Promise<TReturn>, mockFn: (...args: TArgs) => Promise<TReturn>) => {
  return async (...args: TArgs): Promise<TReturn> => {
    const optimistic = await mockFn(...args);
    try {
      return await apiFn(...args);
    } catch {
      pushQueue(domain, method, args);
      return optimistic;
    }
  };
};

const hybridRepositories: Repositories = {
  auth: apiRepositories.auth,
  branches: {
    getBranches: withReadFallback(apiRepositories.branches.getBranches, mockRepositories.branches.getBranches),
    createBranch: withQueuedWrite('branches', 'createBranch', apiRepositories.branches.createBranch, mockRepositories.branches.createBranch),
    updateBranch: withQueuedWrite('branches', 'updateBranch', apiRepositories.branches.updateBranch, mockRepositories.branches.updateBranch),
    deleteBranch: withQueuedWrite('branches', 'deleteBranch', apiRepositories.branches.deleteBranch, mockRepositories.branches.deleteBranch),
    getBranchSettings: withReadFallback(apiRepositories.branches.getBranchSettings, mockRepositories.branches.getBranchSettings),
    updateBranchSettings: withQueuedWrite('branches', 'updateBranchSettings', apiRepositories.branches.updateBranchSettings, mockRepositories.branches.updateBranchSettings),
    resetBranchSettings: withQueuedWrite('branches', 'resetBranchSettings', apiRepositories.branches.resetBranchSettings, mockRepositories.branches.resetBranchSettings),
  },
  doctors: {
    getDoctors: withReadFallback(apiRepositories.doctors.getDoctors, mockRepositories.doctors.getDoctors),
    createDoctor: withQueuedWrite('doctors', 'createDoctor', apiRepositories.doctors.createDoctor, mockRepositories.doctors.createDoctor),
    updateDoctor: withQueuedWrite('doctors', 'updateDoctor', apiRepositories.doctors.updateDoctor, mockRepositories.doctors.updateDoctor),
    getDepartments: withReadFallback(apiRepositories.doctors.getDepartments, mockRepositories.doctors.getDepartments),
    getDoctorProfile: withReadFallback(apiRepositories.doctors.getDoctorProfile, mockRepositories.doctors.getDoctorProfile),
    updateDoctorProfile: withQueuedWrite('doctors', 'updateDoctorProfile', apiRepositories.doctors.updateDoctorProfile, mockRepositories.doctors.updateDoctorProfile),
    updateDoctorAdvancedMode: withQueuedWrite('doctors', 'updateDoctorAdvancedMode', apiRepositories.doctors.updateDoctorAdvancedMode, mockRepositories.doctors.updateDoctorAdvancedMode),
  },
  appointments: {
    getPatients: withReadFallback(apiRepositories.appointments.getPatients, mockRepositories.appointments.getPatients),
    getAppointments: withReadFallback(apiRepositories.appointments.getAppointments, mockRepositories.appointments.getAppointments),
    createPatient: withQueuedWrite('appointments', 'createPatient', apiRepositories.appointments.createPatient, mockRepositories.appointments.createPatient),
    lookupPatientsByPhone: withReadFallback(apiRepositories.appointments.lookupPatientsByPhone, mockRepositories.appointments.lookupPatientsByPhone),
    getAvailableSlotsBulk: withReadFallback(apiRepositories.appointments.getAvailableSlotsBulk, mockRepositories.appointments.getAvailableSlotsBulk),
    createAppointment: withQueuedWrite('appointments', 'createAppointment', apiRepositories.appointments.createAppointment, mockRepositories.appointments.createAppointment),
    startVisitNow: withQueuedWrite('appointments', 'startVisitNow', apiRepositories.appointments.startVisitNow, mockRepositories.appointments.startVisitNow),
    updateAppointmentStatus: withQueuedWrite('appointments', 'updateAppointmentStatus', apiRepositories.appointments.updateAppointmentStatus, mockRepositories.appointments.updateAppointmentStatus),
    addBillingItem: withQueuedWrite('appointments', 'addBillingItem', apiRepositories.appointments.addBillingItem, mockRepositories.appointments.addBillingItem),
    processAppointmentPayment: withQueuedWrite('appointments', 'processAppointmentPayment', apiRepositories.appointments.processAppointmentPayment, mockRepositories.appointments.processAppointmentPayment),
    removeBillingItem: withQueuedWrite('appointments', 'removeBillingItem', apiRepositories.appointments.removeBillingItem, mockRepositories.appointments.removeBillingItem),
    getMedicalEncounter: withReadFallback(apiRepositories.appointments.getMedicalEncounter, mockRepositories.appointments.getMedicalEncounter),
    saveMedicalEncounter: withQueuedWrite('appointments', 'saveMedicalEncounter', apiRepositories.appointments.saveMedicalEncounter, mockRepositories.appointments.saveMedicalEncounter),
    getDelayInsight: withReadFallback(apiRepositories.appointments.getDelayInsight, mockRepositories.appointments.getDelayInsight),
    previewShiftAppointments: withReadFallback(apiRepositories.appointments.previewShiftAppointments, mockRepositories.appointments.previewShiftAppointments),
    shiftAppointments: withQueuedWrite('appointments', 'shiftAppointments', apiRepositories.appointments.shiftAppointments, mockRepositories.appointments.shiftAppointments),
    getPatientAuditTimeline: withReadFallback(apiRepositories.appointments.getPatientAuditTimeline, mockRepositories.appointments.getPatientAuditTimeline),
  },
  settings: {
    getClinicSettings: withReadFallback(apiRepositories.settings.getClinicSettings, mockRepositories.settings.getClinicSettings),
    updateClinicSettings: withQueuedWrite('settings', 'updateClinicSettings', apiRepositories.settings.updateClinicSettings, mockRepositories.settings.updateClinicSettings),
  },
  reports: {
    getFinancialReport: withReadFallback(apiRepositories.reports.getFinancialReport, mockRepositories.reports.getFinancialReport),
    exportFinancialReportCsv: withReadFallback(apiRepositories.reports.exportFinancialReportCsv, mockRepositories.reports.exportFinancialReportCsv),
    getReconciliationReport: withReadFallback(apiRepositories.reports.getReconciliationReport, mockRepositories.reports.getReconciliationReport),
    getDoctorPayrollReport: withReadFallback(apiRepositories.reports.getDoctorPayrollReport, mockRepositories.reports.getDoctorPayrollReport),
    exportDoctorPayrollReportCsv: withReadFallback(apiRepositories.reports.exportDoctorPayrollReportCsv, mockRepositories.reports.exportDoctorPayrollReportCsv),
    closeDoctorPayrollPeriod: withQueuedWrite('reports', 'closeDoctorPayrollPeriod', apiRepositories.reports.closeDoctorPayrollPeriod, mockRepositories.reports.closeDoctorPayrollPeriod),
    settleDoctorPayrollPeriod: withQueuedWrite('reports', 'settleDoctorPayrollPeriod', apiRepositories.reports.settleDoctorPayrollPeriod, mockRepositories.reports.settleDoctorPayrollPeriod),
  },
};

export const createRepositories = (mode: DataSourceMode = DATA_SOURCE_MODE): Repositories => {
  if (mode === 'mock') return mockRepositories;
  if (mode === 'hybrid') return hybridRepositories;
  return apiRepositories;
};

export const repositories = createRepositories();
