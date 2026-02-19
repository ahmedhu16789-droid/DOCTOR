import React from 'react';
import { Dashboard } from '../../pages/Dashboard';
import { CalendarView } from '../CalendarView';
import { AppointmentBooking } from '../../pages/AppointmentBooking';
import { ReceptionQueue } from '../ReceptionQueue';
import { AdminDashboard } from '../../pages/AdminDashboard';
import { EmployeeManagement } from '../../pages/EmployeeManagement';
import { BranchManagement } from '../../pages/BranchManagement';
import { ClinicSettings } from '../../pages/ClinicSettings';
import { FinancialReports } from '../../pages/FinancialReports';
import { PatientsRecords } from '../../pages/PatientsRecords';
import { Appointment, AppointmentStatus, Branch, Patient, PaymentMethod, User } from '../../types';

interface AppMainContentProps {
  activeTab: string;
  user: User | null;
  loading: boolean;
  patients: Patient[];
  branches: Branch[];
  activeBranchId: string;
  visibleAppointments: Appointment[];
  selectedPatientId: string | null;
  onStatusChange: (id: string, newStatus: AppointmentStatus) => void;
  onBook: (apt: Partial<Appointment>) => Promise<void>;
  onPatientCreated: (patient: Patient) => void;
  onOpenEncounter: (apt: Appointment) => void;
  onProcessPayment: (aptId: string, amount: number, method: PaymentMethod) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectPatient: (patientId: string) => void;
  patientQueueLabel: string;
}

export function AppMainContent({
  activeTab,
  user,
  loading,
  patients,
  branches,
  activeBranchId,
  visibleAppointments,
  selectedPatientId,
  onStatusChange,
  onBook,
  onPatientCreated,
  onOpenEncounter,
  onProcessPayment,
  onRefresh,
  onSelectPatient,
  patientQueueLabel,
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          <div className="lg:col-span-2 h-full">
            <CalendarView appointments={visibleAppointments} />
          </div>
          <div className="h-full">
            <AppointmentBooking
              onBook={onBook}
              patients={patients}
              branches={branches}
              activeBranchId={activeBranchId}
              onPatientCreated={onPatientCreated}
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
        <ClinicSettings />
      )}

      {activeTab === 'finance' && user && (
        <FinancialReports />
      )}

      {activeTab === 'patients' && (
        <PatientsRecords
          patients={patients}
          appointments={visibleAppointments}
          selectedPatientId={selectedPatientId}
          onSelectPatient={onSelectPatient}
        />
      )}
    </>
  );
}
