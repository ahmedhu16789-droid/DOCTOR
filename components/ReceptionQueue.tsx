import React, { useState } from 'react';
import { Appointment, AppointmentStatus, UserRole, PaymentStatus } from '../types';
import { Clock, User, CheckCircle, XCircle, Megaphone, Play, Monitor, List, CreditCard } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { useTranslation } from 'react-i18next';

interface ReceptionQueueProps {
  appointments: Appointment[];
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
  onOpenEncounter?: (appointment: Appointment) => void;
  onProcessPayment: (aptId: string, amount: number, method: any) => void;
  userRole: UserRole;
}

export const ReceptionQueue: React.FC<ReceptionQueueProps> = ({ appointments, onUpdateStatus, onOpenEncounter, onProcessPayment, userRole }) => {
  const { t } = useTranslation();
  const [tvMode, setTvMode] = useState(false);
  const [filterDoc, setFilterDoc] = useState('ALL');
  const [paymentApt, setPaymentApt] = useState<Appointment | null>(null);

  // Filter Logic
  const todayIso = new Date().toISOString().slice(0, 10);
  const filtered = appointments
    .filter((a) => a.date.slice(0, 10) === todayIso)
    .filter((a) => filterDoc === 'ALL' || a.doctorId === filterDoc)
    .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot));

  const waiting = filtered.filter(a => a.status === AppointmentStatus.WAITING);
  const inProgress = filtered.filter(a => a.status === AppointmentStatus.IN_PROGRESS);
  const called = filtered.filter(a => a.status === AppointmentStatus.CALLED);

  // Status Transition Logic
  const handleAction = (id: string, current: AppointmentStatus, action: 'checkin' | 'call' | 'start' | 'complete' | 'noshow') => {
    let next = current;
    if (action === 'checkin') next = AppointmentStatus.WAITING;
    if (action === 'call') next = AppointmentStatus.CALLED;
    if (action === 'start') next = AppointmentStatus.IN_PROGRESS;
    if (action === 'complete') next = AppointmentStatus.COMPLETED;
    if (action === 'noshow') next = AppointmentStatus.NO_SHOW;
    onUpdateStatus(id, next);
  };

  const getPaymentStatusBadge = (billing: any) => {
    const due = billing.total - billing.paidAmount;
    if (due <= 0) return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold border border-green-200">PAID</span>;
    if (billing.paidAmount > 0) return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold border border-amber-200">PARTIAL -{due}</span>;
    return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">UNPAID {due}</span>;
  };

  // Extract unique doctors from today's appointments for the filter
  const uniqueDoctors = React.useMemo(() => {
    const docs = new Map();
    appointments.forEach(a => {
      if (!docs.has(a.doctorId)) {
        docs.set(a.doctorId, a.doctorName);
      }
    });
    return Array.from(docs.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  if (tvMode) {
    return (
      <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col p-8">
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-4xl font-bold">{t('waiting_room')}</h1>
          <button onClick={() => setTvMode(false)} className="px-4 py-2 bg-gray-800 rounded text-sm hover:bg-gray-700">{t('exit_tv_mode')}</button>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-8">
          {/* Currently Called */}
          <div className="bg-primary-600 rounded-3xl p-8 flex flex-col items-center justify-center animate-pulse">
            <h2 className="text-3xl font-medium mb-4 uppercase tracking-widest opacity-80">{t('now_calling')}</h2>
            {called.length > 0 ? (
              <>
                <div className="text-6xl font-black text-center mb-4">{called[0].patientName}</div>
                <div className="text-2xl bg-white text-primary-600 px-6 py-2 rounded-full font-bold">
                  {called[0].doctorName}
                </div>
                <div className="mt-4 text-xl">{t('room')} 3</div>
              </>
            ) : (
              <div className="text-3xl opacity-50">{t('please_wait')}</div>
            )}
          </div>

          {/* Up Next List */}
          <div className="bg-gray-800 rounded-3xl p-8 overflow-hidden">
            <h2 className="text-2xl font-bold mb-6 text-gray-400 uppercase">{t('up_next')}</h2>
            <div className="space-y-4">
              {waiting.slice(0, 5).map(apt => (
                <div key={apt.id} className="flex justify-between items-center p-4 bg-gray-700 rounded-xl">
                  <span className="text-2xl font-medium">{apt.patientName}</span>
                  <span className="text-gray-400">{apt.doctorName}</span>
                </div>
              ))}
              {waiting.length === 0 && <p className="text-gray-500 italic">{t('no_patients_waiting')}</p>}
            </div>
          </div>
        </div>
        <div className="mt-8 text-center text-gray-500 text-sm">
          {t('clinic_name')} • {new Date().toLocaleDateString()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">{t('patient_queue')}</h2>
          {userRole !== UserRole.DOCTOR && (
            <select
              className="text-sm border-gray-300 rounded-lg focus:ring-primary-500"
              value={filterDoc}
              onChange={(e) => setFilterDoc(e.target.value)}
            >
              <option value="ALL">{t('all_roles').replace('Roles', 'Doctors')}</option>
              {uniqueDoctors.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 mr-4 text-sm text-gray-500">
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1"></span> {t('waiting')}: {waiting.length}</span>
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-primary-500 mr-1"></span> {t('in_progress')}: {inProgress.length}</span>
          </div>
          <button
            onClick={() => setTvMode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all text-sm font-medium"
          >
            <Monitor className="w-4 h-4" /> {t('tv_mode')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('time')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('patient')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('billing')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((apt) => (
              <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {apt.timeSlot}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold mr-3">
                      {apt.patientName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{apt.patientName}</div>
                      <div className="text-xs text-gray-500 capitalize">{apt.type.toLowerCase()} • {apt.doctorName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                     ${apt.status === AppointmentStatus.SCHEDULED ? 'bg-gray-100 text-gray-800' : ''}
                     ${apt.status === AppointmentStatus.WAITING ? 'bg-amber-100 text-amber-800' : ''}
                     ${apt.status === AppointmentStatus.CALLED ? 'bg-primary-100 text-primary-800 animate-pulse' : ''}
                     ${apt.status === AppointmentStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-800' : ''}
                     ${apt.status === AppointmentStatus.COMPLETED ? 'bg-green-100 text-green-800' : ''}
                   `}>
                    {t(apt.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getPaymentStatusBadge(apt.billing)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    {/* Payment Trigger */}
                    <button onClick={() => setPaymentApt(apt)} className="text-gray-500 hover:text-green-600 p-1 rounded hover:bg-green-50" title={t('pay_now')}>
                      <CreditCard className="w-5 h-5" />
                    </button>

                    {/* Reception Actions */}
                    {apt.status === AppointmentStatus.SCHEDULED && (
                      <>
                        <button onClick={() => handleAction(apt.id, apt.status, 'checkin')} className="text-primary-600 hover:text-primary-900 bg-primary-50 px-3 py-1 rounded">{t('check_in')}</button>
                        <button onClick={() => handleAction(apt.id, apt.status, 'noshow')} className="text-red-600 hover:text-red-900 px-3 py-1">{t('no_show')}</button>
                      </>
                    )}

                    {apt.status === AppointmentStatus.WAITING && (
                      <>
                        <button onClick={() => handleAction(apt.id, apt.status, 'call')} className="flex items-center gap-1 text-amber-600 hover:text-amber-900 bg-amber-50 px-3 py-1 rounded">
                          <Megaphone className="w-3 h-3" /> {t('call_patient')}
                        </button>
                        <button onClick={() => handleAction(apt.id, apt.status, 'noshow')} className="text-red-600 hover:text-red-900 px-3 py-1">{t('no_show')}</button>
                      </>
                    )}

                    {apt.status === AppointmentStatus.CALLED && (
                      <>
                        <button onClick={() => handleAction(apt.id, apt.status, 'start')} className="flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded">
                          <Play className="w-3 h-3" /> {t('start_visit')}
                        </button>
                        <button onClick={() => handleAction(apt.id, apt.status, 'noshow')} className="text-red-600 hover:text-red-900 px-3 py-1">{t('no_show')}</button>
                      </>
                    )}

                    {/* Doctor Actions */}
                    {(apt.status === AppointmentStatus.IN_PROGRESS && (userRole === UserRole.DOCTOR || userRole === UserRole.NURSE)) && (
                      <button onClick={() => onOpenEncounter && onOpenEncounter(apt)} className="flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded shadow-sm">
                        {t('open_workspace')}
                      </button>
                    )}

                    {apt.status === AppointmentStatus.COMPLETED && (
                      <span className="text-gray-400 flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3" /> {t('done')}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Modal Overlay */}
      {paymentApt && (
        <PaymentModal
          appointment={paymentApt}
          onClose={() => setPaymentApt(null)}
          onProcessPayment={(id, amount, method) => {
            onProcessPayment(id, amount, method);
            // Don't close immediately, wait for receipt step inside modal
          }}
        />
      )}
    </div>
  );
};