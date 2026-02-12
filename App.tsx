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
import { User, Appointment, AppointmentStatus, Patient, UserRole, PaymentStatus, ServiceItem, PaymentMethod } from './types';
import { getAppointments, getPatients } from './services/mockData';
import { Users } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'AUTH' | 'APP' | 'PUBLIC'>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Workspace State
  const [activeEncounter, setActiveEncounter] = useState<{apt: Appointment, patient: Patient} | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    if (user || view === 'PUBLIC') {
      setLoading(true);
      Promise.all([getAppointments(), getPatients()]).then(([apts, pts]) => {
        setAppointments(apts);
        setPatients(pts);
        setLoading(false);
      });
    }
  }, [user, view]);

  const handleLogin = (selectedUser: User) => {
    setUser(selectedUser);
    setView('APP');
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setView('AUTH');
    setAppointments([]);
  };

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    setAppointments(prev => prev.map(a => 
      a.id === id ? { ...a, status: newStatus } : a
    ));
  };

  const handleNewBooking = (apt: Partial<Appointment>) => {
    const baseFee = 400; 

    const newApt: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      status: AppointmentStatus.SCHEDULED,
      branchId: 'b1', 
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
    
    setAppointments([...appointments, newApt]);
    alert(`Appointment booked successfully for ${newApt.patientName}`);
  };
  
  const handleOpenEncounter = (apt: Appointment) => {
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
    <DashboardLayout user={user} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
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
          
          {activeTab === 'appointments' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                <div className="lg:col-span-2 h-full">
                   <CalendarView appointments={appointments} />
                </div>
                <div className="h-full">
                   <AppointmentBooking onBook={handleNewBooking} patients={patients} />
                </div>
             </div>
          )}

          {activeTab === 'queue' && user && (
             <div className="h-full">
                <div className="mb-4 flex justify-between items-center">
                   <h2 className="text-xl font-bold">Live Branch Queue</h2>
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
                 <h2 className="text-lg font-bold">Patient Records</h2>
                 <button className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">Add Patient</button>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Visit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">History</th>
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
                          <div className="ml-4">
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