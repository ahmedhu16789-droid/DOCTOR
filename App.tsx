import React, { useState, useEffect, useMemo } from 'react';
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
import { addBillingItemViaApi, clearAuthToken, createAppointmentViaApi, getAppointmentsFromApi, getBranchesFromApi, getPatientsFromApi, getCurrentUser, getStoredUser, processAppointmentPaymentViaApi, removeBillingItemViaApi, updateAppointmentStatusViaApi } from './services/api';
import { setStoredUser } from './services/core/authSession';
import { Activity, CalendarDays, Clock3, Stethoscope, UserRoundSearch, Users } from 'lucide-react';
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
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const getSessionStorageKey = (suffix: string, userId?: string) => `doctor:${suffix}:${userId ?? 'guest'}`;
  const readCachedSessionData = (userId?: string): { appointments: Appointment[]; patients: Patient[]; branches: Branch[] } | null => {
    const raw = localStorage.getItem(getSessionStorageKey('dashboard-cache-v2', userId));

    if (!raw) return null;

    try {
      return JSON.parse(raw) as { appointments: Appointment[]; patients: Patient[]; branches: Branch[] };
    } catch {
      localStorage.removeItem(getSessionStorageKey('dashboard-cache-v2', userId));
      return null;
    }
  };

  const writeCachedSessionData = (payload: { appointments: Appointment[]; patients: Patient[]; branches: Branch[] }, userId?: string) => {
    localStorage.setItem(getSessionStorageKey('dashboard-cache-v2', userId), JSON.stringify(payload));
  };

  // Workspace State
  const [activeEncounter, setActiveEncounter] = useState<{ apt: Appointment, patient: Patient } | null>(null);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const selectedPatientVisits = useMemo(
    () => appointments
      .filter((appointment) => appointment.patientId === selectedPatientId)
      .sort((a, b) => new Date(`${b.date}T${b.timeSlot}`).getTime() - new Date(`${a.date}T${a.timeSlot}`).getTime()),
    [appointments, selectedPatientId],
  );

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

      // Load cached data immediately for snappy UI
      const cachedDashboardData = readCachedSessionData(cachedUser.id);
      if (cachedDashboardData) {
        setPatients(cachedDashboardData.patients ?? []);
        setAppointments(cachedDashboardData.appointments ?? []);
        setBranches(cachedDashboardData.branches ?? []);
      }

      const cachedActiveBranchId = localStorage.getItem(getSessionStorageKey('active-branch', cachedUser.id));
      if (cachedActiveBranchId) {
        setActiveBranchId(cachedActiveBranchId);
      }
    }

    const initSession = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();

        if (currentUser) {
          setUser(currentUser);
          setView('APP');

          // Always fetch fresh data from the API — never trust the cache on page reload
          const [freshPatients, freshAppointments, freshBranches] = await Promise.all([
            getPatientsFromApi(),
            getAppointmentsFromApi([]),
            getBranchesFromApi(),
          ]);
          const patientById = new Map(freshPatients.map((p) => [p.id, p]));
          const hydrated = freshAppointments.map((apt) => ({
            ...apt,
            patientName: patientById.get(apt.patientId)?.name ?? apt.patientName,
          }));
          setPatients(freshPatients);
          setAppointments(hydrated);
          setBranches(freshBranches);
          writeCachedSessionData({ patients: freshPatients, appointments: hydrated, branches: freshBranches }, currentUser.id);
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


  // Shared data-refresh function that can be called from polling, button click, or initial mount
  const refreshData = React.useCallback(async () => {
    if (!user) return;
    try {
      const [freshPatients, freshAppointments, freshBranches] = await Promise.all([
        getPatientsFromApi(),
        getAppointmentsFromApi([]),
        getBranchesFromApi(),
      ]);
      const patientById = new Map(freshPatients.map((p) => [p.id, p]));
      const hydrated = freshAppointments.map((apt) => ({
        ...apt,
        patientName: patientById.get(apt.patientId)?.name ?? apt.patientName,
      }));
      setPatients(freshPatients);
      setAppointments(hydrated);
      setBranches(freshBranches);
    } catch (err) {
      console.error('refreshData error:', err);
    }
  }, [user]);

  // Initial Data Fetch
  const lastLoadedSessionRef = React.useRef<string | null>(null);

  useEffect(() => {
    const sessionKey = view === 'PUBLIC' ? 'PUBLIC' : user?.id ?? null;

    if (!sessionKey) {
      lastLoadedSessionRef.current = null;
      return;
    }

    if (lastLoadedSessionRef.current === sessionKey) {
      return;
    }

    // Prevent duplicate loading
    if (user || view === 'PUBLIC') {
      lastLoadedSessionRef.current = sessionKey;
      const abortController = new AbortController();

      const loadData = async () => {
        setLoading(true);

        try {
          console.log('Initiating data fetch...');
          const refreshPatients = () => getPatientsFromApi();
          const refreshAppointments = () => getAppointmentsFromApi([]);

          const pPatients = refreshPatients().then(res => { console.log('Patients FETCHED'); return res; });
          const pAppointments = refreshAppointments().then(res => { console.log('Appointments FETCHED'); return res; });
          const pBranches = getBranchesFromApi(abortController.signal).then(res => { console.log('Branches FETCHED'); return res; });

          const [patientsResult, appointmentsResult, branchesResult] = await Promise.allSettled([
            pPatients,
            pAppointments,
            pBranches
          ]);

          if (abortController.signal.aborted) return;

          console.log('All promises settled');

          let fallbackAppointments: Appointment[] = [];
          let fallbackPatients: Patient[] = [];
          let fallbackBranches: Branch[] = readCachedSessionData(user?.id)?.branches ?? [];

          if (patientsResult.status !== 'fulfilled' || appointmentsResult.status !== 'fulfilled') {
            [fallbackAppointments, fallbackPatients] = await Promise.all([getAppointments(), getPatients()]);
          }

          const pts = patientsResult.status === 'fulfilled' ? patientsResult.value : fallbackPatients;
          const rawAppointments = appointmentsResult.status === 'fulfilled' ? appointmentsResult.value : fallbackAppointments;

          if (branchesResult.status === 'rejected') {
            console.error('CRITICAL: Branches promise rejected in Promise.allSettled:', branchesResult.reason);
          } else {
            console.log('Branches promise fulfilled:', branchesResult.value);
          }
          const apiBranches = branchesResult.status === 'fulfilled' ? branchesResult.value : fallbackBranches;

          const patientById = new Map(pts.map((patient) => [patient.id, patient]));
          const hydratedAppointments = rawAppointments.map((appointment) => ({
            ...appointment,
            patientName: patientById.get(appointment.patientId)?.name ?? appointment.patientName,
          }));

          setPatients(pts);
          setAppointments(hydratedAppointments);
          setBranches(apiBranches);

          writeCachedSessionData({
            patients: pts,
            appointments: hydratedAppointments,
            branches: apiBranches,
          }, user?.id);

          setActiveBranchId((prev) => {
            if (prev) return prev;

            const userBranchIds = user?.assignedBranches ?? [];
            const defaultUserBranch = userBranchIds.find((id) => apiBranches.some((branch) => branch.id === id));

            console.log('Setting Active Branch ID (Logic):', {
              userBranchIds,
              defaultUserBranch,
              activeBranchId: user?.activeBranchId,
              firstBranch: apiBranches[0]?.id
            });
            return user?.activeBranchId ?? defaultUserBranch ?? apiBranches[0]?.id ?? '';
          });
        } catch (error) {
          lastLoadedSessionRef.current = null;
          console.error('CRITICAL: Verify loadData error:', error);
        } finally {
          if (!abortController.signal.aborted) {
            setLoading(false);
          }
        }
      };

      loadData();

      return () => {
        abortController.abort();
      };
    }
  }, [user, view]);

  // Data Polling (Auto-Sync) — updates every 5s without manual refresh
  useEffect(() => {
    if (!user || view !== 'APP') return;
    const interval = setInterval(() => { refreshData(); }, 5000);
    return () => clearInterval(interval);
  }, [user, view, refreshData]);


  const doctorCurrentShiftBranchId = useMemo(() => {
    if (!user || user.role !== UserRole.DOCTOR || !user.schedule?.length) {
      return null;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const today = now.getDay();

    const matchingShift = user.schedule.find((shift) => {
      if (shift.dayOfWeek !== today || !shift.branchId) {
        return false;
      }

      const [startHour, startMinute] = shift.startTime.split(':').map(Number);
      const [endHour, endMinute] = shift.endTime.split(':').map(Number);

      if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) {
        return false;
      }

      const start = startHour * 60 + startMinute;
      const end = endHour * 60 + endMinute;

      return currentMinutes >= start && currentMinutes < end;
    });

    return matchingShift?.branchId ?? null;
  }, [user]);

  const canDoctorChangeBranch = !doctorCurrentShiftBranchId;

  const handleLogin = (selectedUser: User) => {
    setStoredUser(selectedUser);
    setUser(selectedUser);
    setView('APP');
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (!user) {
      setActiveBranchId('');
      return;
    }

    console.group('Branch Selection Debug');
    console.log('User:', user);
    console.log('User Assigned Branches:', user.assignedBranches);
    console.log('All Branches:', branches);

    const branchOptions = user.role === UserRole.ADMIN
      ? branches.map((branch) => branch.id)
      : branches
        .filter((branch) => user.assignedBranches.includes(branch.id))
        .map((branch) => branch.id);

    console.log('Filtered Branch Options (intersection):', branchOptions);

    if (branchOptions.length === 0) {
      console.warn('No matching branches found for user! assignedBranches vs available branches mismatch.');
      console.groupEnd();
      return;
    }

    if (user.role === UserRole.DOCTOR && doctorCurrentShiftBranchId && branchOptions.includes(doctorCurrentShiftBranchId)) {
      if (activeBranchId !== doctorCurrentShiftBranchId) {
        console.log('Doctor is currently on shift. Locking active branch to:', doctorCurrentShiftBranchId);
        setActiveBranchId(doctorCurrentShiftBranchId);
      }
      console.groupEnd();
      return;
    }

    if (!activeBranchId || !branchOptions.includes(activeBranchId)) {
      // Allow ADMIN to have empty activeBranchId (All Branches)
      if (user.role === UserRole.ADMIN && activeBranchId === '') {
        return;
      }

      const fallbackBranchId = user.activeBranchId && branchOptions.includes(user.activeBranchId)
        ? user.activeBranchId
        : branchOptions[0];

      console.log('Setting Active Branch ID to:', fallbackBranchId);
      setActiveBranchId(fallbackBranchId);
    } else {
      console.log('Active Branch ID already valid:', activeBranchId);
    }
    console.groupEnd();
  }, [user, activeBranchId, branches, doctorCurrentShiftBranchId]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getSessionStorageKey('active-branch', user.id), activeBranchId);
  }, [activeBranchId, user]);


  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    setView('AUTH');
    setAppointments([]);
  };

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    setAppointments((prev) => prev.map((a) =>
      a.id === id ? { ...a, status: newStatus } : a
    ));

    updateAppointmentStatusViaApi(id, newStatus).catch(() => {
      setToast({ type: 'error', message: 'تعذر تحديث حالة الموعد حالياً' });
      getAppointmentsFromApi(patients).then(setAppointments).catch(() => undefined);
    });
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

  const handleCompleteEncounter = (appointmentId: string) => {
    handleStatusChange(appointmentId, AppointmentStatus.COMPLETED);
    setActiveEncounter(null);
  };

  const handleAddService = async (aptId: string, service: ServiceItem) => {
    try {
      const updated = await addBillingItemViaApi(aptId, {
        serviceId: service.id,
        name: service.name,
        category: service.category,
        quantity: 1,
        unitPrice: service.price,
      });
      setAppointments((prev) => prev.map((apt) => (apt.id === aptId ? {
        ...apt,
        billing: {
          ...apt.billing,
          items: updated.billing.items?.map((item) => ({ ...item, addedBy: user?.id || 'system', timestamp: new Date().toISOString() })) ?? [],
          subtotal: updated.billing.total,
          total: updated.billing.total,
          paidAmount: updated.billing.paidAmount,
          status: updated.billing.status,
        },
      } : apt)));
    } catch {
      setToast({ type: 'error', message: 'تعذر إضافة الخدمة حالياً' });
    }
  };

  const handleRemoveService = async (aptId: string, itemId: string) => {
    try {
      const updated = await removeBillingItemViaApi(aptId, itemId);
      setAppointments((prev) => prev.map((apt) => (apt.id === aptId ? {
        ...apt,
        billing: {
          ...apt.billing,
          items: updated.billing.items?.map((item) => ({ ...item, addedBy: user?.id || 'system', timestamp: new Date().toISOString() })) ?? [],
          subtotal: updated.billing.total,
          total: updated.billing.total,
          paidAmount: updated.billing.paidAmount,
          status: updated.billing.status,
        },
      } : apt)));
    } catch {
      setToast({ type: 'error', message: 'تعذر حذف الخدمة حالياً' });
    }
  };

  const handleProcessPayment = async (aptId: string, amount: number, method: PaymentMethod) => {
    try {
      const updated = await processAppointmentPaymentViaApi(aptId, { amount, method });
      setAppointments((prev) => prev.map((apt) => (apt.id === aptId ? {
        ...apt,
        billing: {
          ...apt.billing,
          paidAmount: updated.billing.paidAmount,
          status: updated.billing.status,
          subtotal: updated.billing.total,
          total: updated.billing.total,
          items: updated.billing.items?.map((item) => ({ ...item, addedBy: user?.id || 'system', timestamp: new Date().toISOString() })) ?? apt.billing.items,
        },
      } : apt)));
    } catch {
      setToast({ type: 'error', message: 'تعذر تسجيل الدفعة حالياً' });
    }
  };

  const currentActiveApt = activeEncounter ? appointments.find(a => a.id === activeEncounter.apt.id) : null;

  const visibleAppointments = useMemo(() => {
    let filtered = appointments;

    if (activeBranchId) {
      filtered = filtered.filter((appointment) => appointment.branchId === activeBranchId);
    }

    if (user?.role === UserRole.DOCTOR) {
      filtered = filtered.filter((appointment) => appointment.doctorId === user.id);
    }

    return filtered;
  }, [appointments, activeBranchId, user]);

  // Render Logic
  if (view === 'PUBLIC') {
    return (
      <LanguageProvider>
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
          >
            {toast.message}
          </div>
        )}
        <PublicBooking onBackToLogin={() => setView('AUTH')} />
      </LanguageProvider>
    );
  }

  if (view === 'AUTH') {
    return (
      <LanguageProvider>
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
          >
            {toast.message}
          </div>
        )}
        <Login onLogin={handleLogin} onPublicAccess={() => setView('PUBLIC')} />
      </LanguageProvider>
    );
  }

  if (activeEncounter && user && currentActiveApt) {
    return (
      <LanguageProvider>
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
          >
            {toast.message}
          </div>
        )}
        <DoctorWorkspace
          appointment={currentActiveApt}
          patient={activeEncounter.patient}
          userRole={user.role}
          onClose={handleCloseEncounter}
          onComplete={handleCompleteEncounter}
          onAddService={handleAddService}
          onRemoveService={handleRemoveService}
        />
      </LanguageProvider>
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
      <DashboardLayout
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableBranches={user?.role === UserRole.ADMIN ? branches : branches.filter((branch) => user?.assignedBranches.includes(branch.id) ?? false)}
        activeBranchId={activeBranchId}
        onActiveBranchChange={setActiveBranchId}
        canChangeBranch={user?.role !== UserRole.DOCTOR || canDoctorChangeBranch}
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
                appointments={visibleAppointments}
                onStatusChange={handleStatusChange}
              />
            )}

            {activeTab === 'appointments' && user && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                <div className="lg:col-span-2 h-full">
                  <CalendarView appointments={visibleAppointments} />
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
                  appointments={visibleAppointments}
                  onUpdateStatus={handleStatusChange}
                  onOpenEncounter={handleOpenEncounter}
                  onProcessPayment={handleProcessPayment}
                  onRefresh={refreshData}
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
              <div className="space-y-6">
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
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPatientId(p.id)}
                        className={`hover:bg-gray-50 cursor-pointer ${selectedPatientId === p.id ? 'bg-primary-50/40' : ''}`}
                      >
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

              {selectedPatient ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedPatient.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{selectedPatient.phone}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <p className="text-xs text-gray-500 mb-1">{t('total_visits')}</p>
                        <p className="text-lg font-bold text-gray-900">{selectedPatientVisits.length}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <p className="text-xs text-gray-500 mb-1">{t('completed_visits')}</p>
                        <p className="text-lg font-bold text-emerald-600">{selectedPatientVisits.filter((visit) => visit.status === AppointmentStatus.COMPLETED).length}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <p className="text-xs text-gray-500 mb-1">{t('upcoming_visits')}</p>
                        <p className="text-lg font-bold text-blue-600">{selectedPatientVisits.filter((visit) => [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING, AppointmentStatus.CALLED, AppointmentStatus.IN_PROGRESS].includes(visit.status)).length}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <p className="text-xs text-gray-500 mb-1">{t('last_visit')}</p>
                        <p className="text-lg font-bold text-gray-900">{selectedPatient.lastVisit || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {selectedPatientVisits.length > 0 ? (
                    <div className="space-y-3">
                      {selectedPatientVisits.map((visit) => (
                        <div key={visit.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex flex-wrap justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                                <Stethoscope className="w-4 h-4 text-primary-600" />
                                <span>{visit.doctorName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <CalendarDays className="w-4 h-4" />
                                <span>{visit.date}</span>
                                <Clock3 className="w-4 h-4 ms-2" />
                                <span>{visit.timeSlot}</span>
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                                <Activity className="w-4 h-4" />
                                {visit.status}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('department')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{visit.department}</span>
                            </div>
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('appointment_type')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{visit.type}</span>
                            </div>
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('payment_status')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{visit.billing.status}</span>
                            </div>
                          </div>
                          {visit.notes && (
                            <p className="mt-3 text-sm text-gray-600">
                              <span className="font-semibold text-gray-800">{t('clinical_notes')}:</span> {visit.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                      <UserRoundSearch className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                      {t('no_visits_for_patient')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                  <UserRoundSearch className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                  {t('select_patient_to_view_visits')}
                </div>
              )}
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </LanguageProvider>
  );
}
