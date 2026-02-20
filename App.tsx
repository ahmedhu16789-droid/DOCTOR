import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './pages/Login';
import { PublicBooking } from './pages/PublicBooking';
import { DoctorWorkspace } from './pages/DoctorWorkspace';
import { User, Appointment, AppointmentStatus, Patient, UserRole, PaymentStatus, ServiceItem, PaymentMethod, Branch } from './types';
import { getAppointments, getPatients } from './services/mockData';
import { DataSourceMode, addBillingItemViaApi, clearAuthToken, createAppointmentViaApi, getAppointmentsFromApi, getBranchesFromApi, getPatientsFromApi, getCurrentUser, getStoredUser, processAppointmentPaymentViaApi, removeBillingItemViaApi, updateAppointmentStatusViaApi } from './services/api';
import { setStoredUser } from './services/core/authSession';
import { AppShell } from './components/app/AppShell';
import { AppMainContent } from './components/app/AppMainContent';

import { useTranslation } from 'react-i18next';


interface HybridEntityIdMap {
  patient?: Record<string, string>;
  doctor?: Record<string, string>;
  branch?: Record<string, string>;
}

const DATA_SOURCE_MODE: DataSourceMode = (() => {
  const rawMode = String(import.meta.env.VITE_DATA_SOURCE_MODE ?? 'api').toLowerCase();
  if (rawMode === 'mock' || rawMode === 'hybrid' || rawMode === 'api') {
    return rawMode;
  }

  return 'api';
})();

const HYBRID_ID_MAP_STORAGE_KEY = 'doctor:hybrid-id-map:v1';
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
      setToast({ type: 'error', message: t('appointment_status_update_failed') });
      getAppointmentsFromApi(patients).then(setAppointments).catch(() => undefined);
    });
  };

  const hybridEntityIdMap: HybridEntityIdMap = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(HYBRID_ID_MAP_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as HybridEntityIdMap;
    } catch {
      return {};
    }
  }, []);

  const isHybridEntitySynced = React.useCallback((kind: keyof HybridEntityIdMap, id: string) => {
    if (!id) return false;
    if (/^\d+$/.test(id)) return true;
    const translatedId = hybridEntityIdMap[kind]?.[id];
    return typeof translatedId === 'string' && /^\d+$/.test(translatedId);
  }, [hybridEntityIdMap]);

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

    if (DATA_SOURCE_MODE === 'mock') {
      setAppointments((prev) => [...prev, newApt]);
      setToast({ type: 'success', message: t('booking_saved_for_patient', { patientName: newApt.patientName }) });
      return;
    }

    try {
      await createAppointmentViaApi(newApt, {
        dataSourceMode: DATA_SOURCE_MODE,
        entityIdMap: hybridEntityIdMap,
      });
      const refreshedAppointments = await getAppointmentsFromApi(patients);
      setAppointments(refreshedAppointments);
      setToast({ type: 'success', message: t('booking_saved_for_patient', { patientName: newApt.patientName }) });
    } catch (error) {
      setAppointments((prev) => [...prev, newApt]);
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : t('booking_save_failed_for_patient', { patientName: newApt.patientName }),
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
      setToast({ type: 'error', message: t('service_add_failed') });
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
      setToast({ type: 'error', message: t('service_remove_failed') });
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
      setToast({ type: 'error', message: t('payment_record_failed') });
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
      <AppShell toast={toast}>
        <PublicBooking onBackToLogin={() => setView('AUTH')} />
      </AppShell>
    );
  }

  if (view === 'AUTH') {
    return (
      <AppShell toast={toast}>
        <Login onLogin={handleLogin} onPublicAccess={() => setView('PUBLIC')} />
      </AppShell>
    );
  }

  if (activeEncounter && user && currentActiveApt) {
    return (
      <AppShell toast={toast}>
        <DoctorWorkspace
          appointment={currentActiveApt}
          patient={activeEncounter.patient}
          userRole={user.role}
          onClose={handleCloseEncounter}
          onComplete={handleCompleteEncounter}
          onAddService={handleAddService}
          onRemoveService={handleRemoveService}
        />
      </AppShell>
    );
  }

  return (
    <AppShell toast={toast}>
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
        <AppMainContent
          activeTab={activeTab}
          user={user}
          loading={loading}
          patients={patients}
          branches={branches}
          activeBranchId={activeBranchId}
          visibleAppointments={visibleAppointments}
          allAppointments={appointments}
          selectedPatientId={selectedPatientId}
          onStatusChange={handleStatusChange}
          onBook={handleNewBooking}
          onPatientCreated={(patient) => setPatients((prev) => [patient, ...prev])}
          onOpenEncounter={handleOpenEncounter}
          onProcessPayment={handleProcessPayment}
          onRefresh={refreshData}
          onSelectPatient={setSelectedPatientId}
          patientQueueLabel={t('patient_queue')}
          dataSourceMode={DATA_SOURCE_MODE}
          isHybridEntitySynced={isHybridEntitySynced}
        />
      </DashboardLayout>
    </AppShell>
  );
}
