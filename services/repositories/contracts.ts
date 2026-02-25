import { Appointment, AppointmentStatus, Branch, BranchOperationalSettings, BranchSettingsEnvelope, Patient, PaymentEntry, PaymentMethod, User, VitalSigns } from '../../types';
import { AccessLinkResponse, ApiAppointment, ApiDepartmentOption, AuditTimelineEntry, ClinicSettingsPayload, DelayInsightResponse, DoctorPayrollReportFilters, DoctorPayrollReportRecord, DoctorPayrollSettlementPayload, FinancialReportPayload, MedicalEncounterWithHistory, ReconciliationSummaryRecord, ReportExportPayload } from '../api';

export type DataSourceMode = 'api' | 'mock' | 'hybrid';

export interface AuthRepository {
  login(email: string, password: string): Promise<User>;
  getCurrentUser(): Promise<User>;
  clearAuthToken(): void;
  consumeAccessLink(payload: { token: string; email: string; password: string }): Promise<void>;
  createAccessLink(userId: string): Promise<AccessLinkResponse>;
}

export interface BranchesRepository {
  getBranches(signal?: AbortSignal): Promise<Branch[]>;
  createBranch(branch: Omit<Branch, 'id'>): Promise<Branch>;
  updateBranch(branch: Branch): Promise<Branch>;
  deleteBranch(branchId: string): Promise<void>;
  getBranchSettings(branchId: string): Promise<BranchSettingsEnvelope>;
  updateBranchSettings(branchId: string, settings: BranchOperationalSettings): Promise<BranchSettingsEnvelope>;
  resetBranchSettings(branchId: string): Promise<BranchSettingsEnvelope>;
}

export interface DoctorsRepository {
  getDoctors(params?: { branchId?: string; specialty?: string; name?: string }): Promise<User[]>;
  createDoctor(doctor: User): Promise<User>;
  updateDoctor(doctor: User): Promise<User>;
  getDepartments(): Promise<ApiDepartmentOption[]>;
  getDoctorProfile(): Promise<any>;
  updateDoctorProfile(payload: any): Promise<any>;
  updateDoctorAdvancedMode(enabled: boolean, branchId?: string): Promise<any>;
}

export interface AppointmentsRepository {
  getPatients(): Promise<Patient[]>;
  getAppointments(patients?: Patient[], params?: { date?: string }): Promise<Appointment[]>;
  createPatient(patient: Pick<Patient, 'name' | 'phone' | 'age' | 'gender'> & { medicalHistorySummary?: string }): Promise<Patient>;
  lookupPatientsByPhone(phone: string, name?: string): Promise<Patient[]>;
  getAvailableSlotsBulk(params: { doctorIds: string[]; branchId: string; date: string }): Promise<Record<string, { time: string; available: boolean }[]>>;
  createAppointment(appointment: Partial<Appointment>, context?: any): Promise<ApiAppointment>;
  startVisitNow(appointmentId: string): Promise<ApiAppointment>;
  updateAppointmentStatus(appointmentId: string, status: AppointmentStatus): Promise<ApiAppointment>;
  addBillingItem(appointmentId: string, service: { serviceId?: string; name: string; category?: string; quantity?: number; unitPrice: number }): Promise<ApiAppointment>;
  processAppointmentPayment(appointmentId: string, payload: { amount?: number; method?: PaymentMethod; payments?: PaymentEntry[] }): Promise<ApiAppointment>;
  removeBillingItem(appointmentId: string, itemId: string): Promise<ApiAppointment>;
  getMedicalEncounter(appointmentId: string): Promise<MedicalEncounterWithHistory>;
  saveMedicalEncounter(appointmentId: string, payload: {
    vitals?: VitalSigns;
    examFindings?: string;
    diagnosis?: string;
    plan?: string;
    nextVisitDate?: string;
    nextVisitType?: string;
    nextVisitInterval?: number;
    status?: 'DRAFT' | 'FINALIZED';
    prescription: any[];
  }): Promise<any>;
  getDelayInsight(params: { doctorId: string; branchId: string; date?: string }): Promise<DelayInsightResponse>;
  previewShiftAppointments(params: { doctorId: string; branchId: string; date: string; fromTime: string; shiftMinutes: number }): Promise<DelayInsightResponse>;
  shiftAppointments(params: { doctorId: string; branchId: string; date: string; fromTime: string; shiftMinutes: number; appliedByUserId?: string | null }): Promise<any>;
  getPatientAuditTimeline(patientId: string): Promise<AuditTimelineEntry[]>;
}

export interface SettingsRepository {
  getClinicSettings(): Promise<ClinicSettingsPayload>;
  updateClinicSettings(settings: ClinicSettingsPayload): Promise<ClinicSettingsPayload>;
}

export interface ReportsRepository {
  getFinancialReport(params?: { from?: string; to?: string; branchId?: string }): Promise<FinancialReportPayload>;
  exportFinancialReportCsv(params?: { from?: string; to?: string; branchId?: string }): Promise<ReportExportPayload>;
  getReconciliationReport(params?: { branchId?: string; date?: string }): Promise<ReconciliationSummaryRecord[]>;
  getDoctorPayrollReport(params?: DoctorPayrollReportFilters): Promise<DoctorPayrollReportRecord[]>;
  exportDoctorPayrollReportCsv(params?: DoctorPayrollReportFilters): Promise<ReportExportPayload>;
  closeDoctorPayrollPeriod(periodId: string): Promise<void>;
  settleDoctorPayrollPeriod(periodId: string, payload: DoctorPayrollSettlementPayload): Promise<void>;
}

export interface Repositories {
  auth: AuthRepository;
  branches: BranchesRepository;
  doctors: DoctorsRepository;
  appointments: AppointmentsRepository;
  settings: SettingsRepository;
  reports: ReportsRepository;
}
