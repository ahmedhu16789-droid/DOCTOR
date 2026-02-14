import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { AppointmentBooking } from './pages/AppointmentBooking';
import { PublicBooking } from './pages/PublicBooking';
import { CalendarView } from './components/CalendarView';
import { ReceptionQueue } from './components/ReceptionQueue';
import { DoctorWorkspace } from './pages/DoctorWorkspace';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { FinancialReports } from './pages/FinancialReports';
import { BranchManagement } from './pages/BranchManagement';
import { ClinicSettings } from './pages/ClinicSettings';
import { User, Appointment, AppointmentStatus, Patient, UserRole, PaymentStatus, ServiceItem, PaymentMethod, Branch } from './types';
import { getAppointments, getPatients } from './services/mockData';
import { clearAuthToken, createAppointmentViaApi, getAppointmentsFromApi, getBranchesFromApi, getPatientsFromApi, getCurrentUser, getStoredUser } from './services/api';
import { Users } from 'lucide-react';
import { LanguageProvider } from './contexts/LanguageContext';

import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<'AUTH' | 'APP' | 'PUBLIC'>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    // Restore active tab from localStorage on page load
    const saved = localStorage.getItem('activeTab');
    return saved || 'dashboard';
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Workspace State
  const [activeEncounter, setActiveEncounter] = useState<{ apt: Appointment, patient: Patient } | null>(null);

  // Persist activeTab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2500);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Initial Session Check
  const sessionInitializedRef = React.useRef(false);

  useEffect(() => {
    if (sessionInitializedRef.current) return;
    sessionInitializedRef.current = true;

    const cachedUser = getStoredUser();

    if (cachedUser) {
      setUser(cachedUser);
      setView('APP');
    }

    const initSession = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();

        if (currentUser) {
          setUser(currentUser);
          setView('APP');
        }
      } catch (error) {
        if (!cachedUser) {
          console.error('Session restoration failed:', error);
          clearAuthToken();
          setView('AUTH');
        }
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // Initial Data Fetch
  const dataLoadedRef = React.useRef(false);

  useEffect(() => {
    // Prevent duplicate loading
    if (dataLoadedRef.current) return;

    if (user || view === 'PUBLIC') {
      dataLoadedRef.current = true;
      setLoading(true);

      const abortController = new AbortController();

      Promise.all([
        getPatientsFromApi(),
        getAppointmentsFromApi([]),
        getBranchesFromApi(),
      ])
        .then(([pts, apiAppointments, apiBranches]) => {
          if (abortController.signal.aborted) return;

          const patientById = new Map(pts.map((patient) => [patient.id, patient]));
          const hydratedAppointments = apiAppointments.map((appointment) => ({
            ...appointment,
            patientName: patientById.get(appointment.patientId)?.name ?? appointment.patientName,
          }));

          setPatients(pts);
          setAppointments(hydratedAppointments);
          setBranches(apiBranches);

          setActiveBranchId((prev) => {
            if (prev) return prev;

            const userBranchIds = user?.assignedBranches ?? [];
            const defaultUserBranch = userBranchIds.find((id) => apiBranches.some((branch) => branch.id === id));

            return defaultUserBranch ?? user?.activeBranchId ?? apiBranches[0]?.id ?? '';
          });
        })
        .catch(async (error) => {
          if (abortController.signal.aborted) return;

          const [apts, pts] = await Promise.all([getAppointments(), getPatients()]);
          setAppointments(apts);
          setPatients(pts);
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setLoading(false);
          }
        });

      return () => {
        abortController.abort();
      };
    }
  }, [user, view]);

  const handleLogin = (selectedUser: User) => {
    setUser(selectedUser);
    setView('APP');
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (!user) {
      setActiveBranchId('');
      return;
    }

    const branchOptions = branches
      .filter((branch) => user.assignedBranches.includes(branch.id))
      .map((branch) => branch.id);

    if (branchOptions.length === 0) {
      return;
    }

    if (!activeBranchId || !branchOptions.includes(activeBranchId)) {
      const fallbackBranchId = user.activeBranchId && branchOptions.includes(user.activeBranchId)
        ? user.activeBranchId
        : branchOptions[0];

      setActiveBranchId(fallbackBranchId);
    }
  }, [user, activeBranchId, branches]);


  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    setView('AUTH');
    setAppointments([]);
  };

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    setAppointments(prev => prev.map(a =>
      a.id === id ? { ...a, status: newStatus } : a
    ));
  };

  const handleNewBooking = async (apt: Partial<Appointment>) => {
    const baseFee = 400;

    const newApt: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      status: AppointmentStatus.SCHEDULED,
      ...apt,
      createdAt: new Date().toISOString(),
      billing: {
        items: [{
          id: Math.random().toString(),
          serviceId: 'srv_cns',
          name: 'Consultation Fee',
          quantity: 1,
          unitPrice: baseFee,
          total: baseFee,
          addedBy: 'system',
          timestamp: new Date().toISOString()
        }],
        subtotal: baseFee,
        discount: 0,
        total: baseFee,
        paidAmount: 0,
        status: PaymentStatus.UNPAID,
        transactions: []
      }
    } as Appointment;

    try {
      await createAppointmentViaApi(newApt);
      const refreshedAppointments = await getAppointmentsFromApi(patients);
      setAppointments(refreshedAppointments);
      setToast({ type: 'success', message: `تم حفظ الحجز لـ ${newApt.patientName}` });
    } catch (error) {
      setAppointments((prev) => [...prev, newApt]);
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : `تعذر حفظ الحجز على السيرفر لـ ${newApt.patientName}`,
      });
    }
  };

  const handleOpenEncounter = (apt: Appointment) => {
    setActiveBranchId(apt.branchId);
    const patient = patients.find(p => p.id === apt.patientId);
    if (patient) {
      setActiveEncounter({ apt, patient });
    }
  };

  const handleCloseEncounter = () => {
    setActiveEncounter(null);
  };

  const handleCompleteEncounter = () => {
    if (activeEncounter) {
      handleStatusChange(activeEncounter.apt.id, AppointmentStatus.COMPLETED);
      setActiveEncounter(null);
    }
  };

  const handleAddService = (aptId: string, service: ServiceItem) => {
    setAppointments(prev => prev.map(apt => {
      if (apt.id !== aptId) return apt;

      const newItem = {
        id: Math.random().toString(),
        serviceId: service.id,
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        total: service.price,
        addedBy: user?.id || 'unknown',
        timestamp: new Date().toISOString()
      };

      const updatedItems = [...apt.billing.items, newItem];
      const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

      return {
        ...apt,
        billing: {
          ...apt.billing,
          items: updatedItems,
          subtotal: newTotal,
          total: newTotal - apt.billing.discount,
          status: (newTotal - apt.billing.discount) <= apt.billing.paidAmount ? PaymentStatus.PAID : PaymentStatus.UNPAID
        }
      };
    }));
  };

  const handleRemoveService = (aptId: string, itemId: string) => {
    setAppointments(prev => prev.map(apt => {
      if (apt.id !== aptId) return apt;

      const updatedItems = apt.billing.items.filter(item => item.id !== itemId);
      const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

      return {
        ...apt,
        billing: {
          ...apt.billing,
          items: updatedItems,
          subtotal: newTotal,
          total: newTotal - apt.billing.discount,
          status: (newTotal - apt.billing.discount) <= apt.billing.paidAmount ? PaymentStatus.PAID : PaymentStatus.UNPAID
        }
      };
    }));
  };

  const handleProcessPayment = (aptId: string, amount: number, method: PaymentMethod) => {
    setAppointments(prev => prev.map(apt => {
      if (apt.id !== aptId) return apt;

      const newPaidAmount = apt.billing.paidAmount + amount;
      const newTransaction = {
        id: Math.random().toString(),
        amount,
        method,
        timestamp: new Date().toISOString(),
        recordedBy: user?.id || 'unknown',
        reference: `REC-${Math.floor(Math.random() * 10000)}`,
        type: 'PAYMENT' as const
      };

      return {
        ...apt,
        billing: {
          ...apt.billing,
          paidAmount: newPaidAmount,
          transactions: [...apt.billing.transactions, newTransaction],
          status: newPaidAmount >= apt.billing.total ? PaymentStatus.PAID : PaymentStatus.PARTIAL
        }
      };
    }));
  };

  const currentActiveApt = activeEncounter ? appointments.find(a => a.id === activeEncounter.apt.id) : null;

  const MainContent = () => {
    if (view === 'PUBLIC') {
      return <PublicBooking onBackToLogin={() => setView('AUTH')} />;
    }

    if (view === 'AUTH') {
      return <Login onLogin={handleLogin} onPublicAccess={() => setView('PUBLIC')} />;
    }

    if (activeEncounter && user && currentActiveApt) {
      return (
        <DoctorWorkspace
          appointment={currentActiveApt}
          patient={activeEncounter.patient}
          userRole={user.role}
          onClose={handleCloseEncounter}
          onComplete={handleCompleteEncounter}
          onAddService={handleAddService}
          onRemoveService={handleRemoveService}
        />
      );
    }

    return (
      <DashboardLayout
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableBranches={branches.filter((branch) => user?.assignedBranches.includes(branch.id) ?? false)}
        activeBranchId={activeBranchId}
        onActiveBranchChange={setActiveBranchId}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && user && (
              <Dashboard
                user={user}
                appointments={appointments}
                onStatusChange={handleStatusChange}
              />
            )}

            {activeTab === 'appointments' && user && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                <div className="lg:col-span-2 h-full">
                  <CalendarView appointments={appointments} />
                </div>
                <div className="h-full">
                  <AppointmentBooking
                    onBook={handleNewBooking}
                    patients={patients}
                    branches={branches}
                    activeBranchId={activeBranchId}
                    onPatientCreated={(patient) => setPatients((prev) => [patient, ...prev])}
                  />
                </div>
              </div>
            )}

            {activeTab === 'queue' && user && (
              <div className="h-full">
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold">{t('patient_queue')}</h2>
                </div>
                <ReceptionQueue
                  appointments={appointments}
                  onUpdateStatus={handleStatusChange}
                  onOpenEncounter={handleOpenEncounter}
                  onProcessPayment={handleProcessPayment}
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-lg font-bold">{t('patient_records')}</h2>
                  <button className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">{t('add_patient')}</button>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('name')}</th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('contact')}</th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('last_visit')}</th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('history')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {patients.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="ms-4">
                              <div className="text-sm font-medium text-gray-900">{p.name}</div>
                              <div className="text-sm text-gray-500">Age: {p.age}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.lastVisit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">{p.medicalHistorySummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    );
  }

  return (
    <LanguageProvider>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
        >
          {toast.message}
        </div>
      )}
      <MainContent />
    </LanguageProvider>
  );
}
