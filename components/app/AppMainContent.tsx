import React from 'react';
import { Dashboard } from '../../pages/Dashboard';
import { CalendarView } from '../CalendarView';
import { AppointmentBooking } from '../../pages/AppointmentBooking';
import { BulkShiftPanel } from '../appointments/BulkShiftPanel';
import { ReceptionQueue } from '../ReceptionQueue';
import { AdminDashboard } from '../../pages/AdminDashboard';
import { EmployeeManagement } from '../../pages/EmployeeManagement';
import { BranchManagement } from '../../pages/BranchManagement';
import { ClinicSettings } from '../../pages/ClinicSettings';
import { DoctorProfile } from '../../pages/DoctorProfile';
import { FinancialReports } from '../../pages/FinancialReports';
import { PatientsRecords } from '../../pages/PatientsRecords';
import { DoctorPayrollReports } from '../../pages/DoctorPayrollReports';
import { AppointmentMigration } from '../../pages/AppointmentMigration';
import { Appointment, AppointmentStatus, Branch, Patient, PaymentEntry, User, UserRole } from '../../types';
import { DataSourceMode } from '../../services/api';

interface AppMainContentProps {
  activeTab: string;
  user: User | null;
  loading: boolean;
  patients: Patient[];
  branches: Branch[];
  activeBranchId: string;
  visibleAppointments: Appointment[];
  allAppointments: Appointment[];
  selectedPatientId: string | null;
  onStatusChange: (id: string, newStatus: AppointmentStatus) => void;
  onStartVisitNow: (id: string) => Promise<void>;
  onBook: (apt: Partial<Appointment>) => Promise<void>;
  onPatientCreated: (patient: Patient) => void;
  onOpenEncounter: (apt: Appointment) => void;
  onProcessPayment: (aptId: string, payments: PaymentEntry[]) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectPatient: (patientId: string | null) => void;
  patientQueueLabel: string;
  dataSourceMode: DataSourceMode;
  isHybridEntitySynced: (kind: 'patient' | 'doctor' | 'branch', id: string) => boolean;
}

export function AppMainContent({
  activeTab,
  user,
  loading,
  patients,
  branches,
  activeBranchId,
  visibleAppointments,
  allAppointments,
  selectedPatientId,
  onStatusChange,
  onStartVisitNow,
  onBook,
  onPatientCreated,
  onOpenEncounter,
  onProcessPayment,
  onRefresh,
  onSelectPatient,
  patientQueueLabel,
  dataSourceMode,
  isHybridEntitySynced,
}: AppMainContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      {activeTab === 'dashboard' && user && (
        <Dashboard
          user={user}
          appointments={visibleAppointments}
          onStatusChange={onStatusChange}
        />
      )}

      {activeTab === 'appointments' && user && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-140px)]">
          <div className="lg:col-span-3 h-full transition-all duration-300">
            <CalendarView appointments={visibleAppointments} />
          </div>
          <div className="lg:col-span-2 h-full transition-all duration-300 space-y-4">
            <BulkShiftPanel
              activeBranchId={activeBranchId}
              currentUser={user}
              onShiftApplied={onRefresh}
            />
            <AppointmentBooking
              onBook={onBook}
              patients={patients}
              branches={branches}
              activeBranchId={activeBranchId}
              onPatientCreated={onPatientCreated}
              dataSourceMode={dataSourceMode}
              isHybridEntitySynced={isHybridEntitySynced}
            />
          </div>
        </div>
      )}

      {activeTab === 'queue' && user && (
        <div className="h-full">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold">{patientQueueLabel}</h2>
          </div>
          <ReceptionQueue
            appointments={visibleAppointments}
            onUpdateStatus={onStatusChange}
            onStartVisitNow={onStartVisitNow}
            onOpenEncounter={onOpenEncounter}
            onProcessPayment={onProcessPayment}
            onRefresh={onRefresh}
            userRole={user.role}
          />
        </div>
      )}

      {activeTab === 'doctors' && user && (
        <AdminDashboard currentUser={user} />
      )}

      {activeTab === 'employees' && user && (
        <EmployeeManagement currentUser={user} />
      )}

      {activeTab === 'branches' && user && (
        <BranchManagement />
      )}

      {activeTab === 'settings' && user && (
        user.role === UserRole.DOCTOR ? <DoctorProfile /> : <ClinicSettings />
      )}

      {activeTab === 'finance' && user && (
        <FinancialReports />
      )}

      {activeTab === 'doctor-payroll' && user && (
        <DoctorPayrollReports />
      )}

      {activeTab === 'appointment-migration' && user && (
        <AppointmentMigration
          currentUser={user}
          activeBranchId={activeBranchId}
          branches={branches}
          onShiftApplied={onRefresh}
        />
      )}

      {activeTab === 'patients' && (
        <PatientsRecords
          patients={patients}
          appointments={allAppointments}
          selectedPatientId={selectedPatientId}
          onSelectPatient={onSelectPatient}
        />
      )}
    </>
  );
}
