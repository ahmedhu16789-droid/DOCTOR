import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, Branch, Department, Patient, User } from '../types';
import { DEPARTMENTS } from '../constants';
import { PatientLookup } from '../components/PatientLookup';
import { Select } from '../components/common/Select';
import { CheckCircle, Calendar, User as UserIcon, Clock, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataSourceMode } from '../services/repositories/contracts';
import { repositories } from '../services/repositories';
import { formatTimeTo12Hour } from '../utils/time';

interface AppointmentBookingProps {
  onBook: (apt: Partial<Appointment> & { earlyCheckinForAppointmentId?: string }) => void;
  patients: Patient[];
  branches: Branch[];
  allAppointments?: Appointment[];
  activeBranchId: string;
  onPatientCreated: (patient: Patient) => void;
  onStepChange?: (step: BookingStep) => void;
  dataSourceMode: DataSourceMode;
  isHybridEntitySynced: (kind: 'patient' | 'doctor' | 'branch', id: string) => boolean;
}

type BookingStep = 'IDENTIFICATION' | 'SELECTION' | 'CONFIRMATION';

export const AppointmentBooking: React.FC<AppointmentBookingProps> = ({ onBook, patients, branches, allAppointments = [], activeBranchId, onPatientCreated, onStepChange, dataSourceMode, isHybridEntitySynced }) => {
  const { t } = useTranslation();

  const [step, setStep] = useState<BookingStep>('IDENTIFICATION');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department>(Department.INTERNAL_MEDICINE);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [doctors, setDoctors] = useState<User[]>([]);
  const [slotsByDoctor, setSlotsByDoctor] = useState<Record<string, { time: string; available: boolean }[]>>({});
  const [bookingGuardMessage, setBookingGuardMessage] = useState<string | null>(null);
  const [isEarlyCheckin, setIsEarlyCheckin] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState<string | null>(null);

  // Find if the selected patient has a later SCHEDULED appointment today
  const patientLaterAppointment = useMemo(() => {
    if (!selectedPatient) return null;
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);
    return allAppointments.find(
      (apt) =>
        apt.patientId === selectedPatient.id &&
        apt.date === today &&
        apt.timeSlot > nowTime &&
        ['SCHEDULED', 'WAITING'].includes(apt.status)
    ) ?? null;
  }, [selectedPatient, allAppointments]);

  const activeBranch = useMemo(() => branches.find((branch) => branch.id === activeBranchId), [activeBranchId, branches]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    if (!activeBranchId) return;

    repositories.doctors.getDoctors({ branchId: activeBranchId, specialty: selectedDept })
      .then((payload) => {
        setDoctors(payload);
        setAvailabilityWarning(null);
      })
      .catch(() => {
        setAvailabilityWarning(t('failed_fetch_doctors_fallback', { defaultValue: 'تعذر تحديث قائمة الأطباء حالياً. تم الإبقاء على آخر بيانات متاحة.' }));
      });
  }, [activeBranchId, selectedDept]);

  useEffect(() => {
    if (!activeBranchId || doctors.length === 0) {
      setSlotsByDoctor({});
      return;
    }

    repositories.appointments.getAvailableSlotsBulk({
      doctorIds: doctors.map((doctor) => doctor.id),
      branchId: activeBranchId,
      date: selectedDate,
    })
      .then((payload) => {
        setSlotsByDoctor(payload);
        setAvailabilityWarning(null);
      })
      .catch(() => {
        setAvailabilityWarning(t('failed_fetch_slots_fallback', { defaultValue: 'تعذر تحديث المواعيد المتاحة الآن. تم الإبقاء على آخر بيانات متاحة.' }));
      });
  }, [doctors, activeBranchId, selectedDate]);

  useEffect(() => {
    if (!selectedDoctor || !selectedTime) return;

    const doctorSlots = slotsByDoctor[selectedDoctor.id] ?? [];
    const selectedSlotExists = doctorSlots.some((slot) => slot.time === selectedTime && slot.available);

    if (!selectedSlotExists) {
      setSelectedDoctor(null);
      setSelectedTime('');
    }
  }, [slotsByDoctor, selectedDoctor, selectedTime]);

  const handlePatientCreate = async (newPatientData: Partial<Patient>) => {
    const created = await repositories.appointments.createPatient({
      name: newPatientData.name ?? '',
      phone: newPatientData.phone ?? '',
      age: newPatientData.age ?? 0,
      gender: (newPatientData.gender as 'Male' | 'Female') ?? 'Male',
      medicalHistorySummary: newPatientData.medicalHistorySummary,
    });

    onPatientCreated(created);

    return created;
  };

  const handleConfirm = () => {
    if (selectedPatient && selectedDoctor && selectedTime && activeBranchId) {
      if (dataSourceMode === 'mock') {
        setBookingGuardMessage('Mock mode uses local IDs only, API booking is skipped.');
      } else if (dataSourceMode === 'hybrid') {
        const hasUnsyncedEntity = !isHybridEntitySynced('patient', selectedPatient.id)
          || !isHybridEntitySynced('doctor', selectedDoctor.id)
          || !isHybridEntitySynced('branch', activeBranchId);

        if (hasUnsyncedEntity) {
          setBookingGuardMessage('Hybrid mode requires sync/ID translation for patient, doctor, and branch before API booking.');
          return;
        }
      }

      setBookingGuardMessage(null);
      onBook({
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        branchId: activeBranchId,
        date: selectedDate,
        timeSlot: selectedTime,
        department: selectedDept,
        type: 'Consultation',
        billing: {
          subtotal: selectedDoctor.consultationFee || 400
        } as any,
        ...(isEarlyCheckin && patientLaterAppointment ? { earlyCheckinForAppointmentId: patientLaterAppointment.id } : {}),
      });
      setStep('IDENTIFICATION');
      setSelectedPatient(null);
      setSelectedTime('');
      setSelectedDoctor(null);
      setIsEarlyCheckin(false);
    }
  };

  const renderDoctorRow = (doctor: User) => {
    const slots = slotsByDoctor[doctor.id] ?? [];
    const availableSlots = slots.filter((slot) => slot.available);

    return (
      <div key={doctor.id} className="bg-white border border-gray-200 rounded-xl p-4 mb-3 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center min-w-0">
            <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="ml-3 sm:ms-3 min-w-0">
              <p className="font-bold text-gray-900 truncate">{doctor.name}</p>
              <p className="text-xs text-gray-500 capitalize truncate">{doctor.specialty}</p>
            </div>
          </div>
          <span className="text-xs bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2.5 py-1 font-semibold whitespace-nowrap">
            {t('available_slots_count', { count: availableSlots.length })}
          </span>
        </div>

        {availableSlots.length === 0 ? (
          <div className="text-xs text-red-500 font-medium py-2">{t('no_slots')}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {availableSlots.map((slot) => {
              const isSelected = selectedDoctor?.id === doctor.id && selectedTime === slot.time;
              return (
                <button
                  key={`${doctor.id}-${slot.time}`}
                  type="button"
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setSelectedTime(slot.time);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-all border ${isSelected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm ring-2 ring-primary-200'
                    : 'bg-white border-primary-200 text-primary-700 hover:bg-primary-50 hover:border-primary-300'}`}
                >
                  {formatTimeTo12Hour(slot.time)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-full max-h-[800px]">
      <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center min-w-0">
          <Calendar className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 text-primary-600" />
          <span className="truncate">
            {step === 'IDENTIFICATION' ? t('identification') : step === 'SELECTION' ? t('select_slot') : t('confirmation')}
          </span>
        </h2>
        {step !== 'IDENTIFICATION' && (
          <button onClick={() => setStep('IDENTIFICATION')} className="text-sm text-gray-500 hover:text-primary-600 flex-shrink-0">{t('change')}</button>
        )}
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {step === 'IDENTIFICATION' && (
          <PatientLookup
            patients={patients}
            onSelectPatient={(patient) => {
              setSelectedPatient(patient);
              setStep('SELECTION');
            }}
            onAddNewPatient={handlePatientCreate}
            onSearchByPhone={(phone, name) => repositories.appointments.lookupPatientsByPhone(phone, name)}
          />
        )}

        {step === 'SELECTION' && (
          <div className="space-y-6">
            {!activeBranchId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm">
                {t('no_active_branch_for_user')}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t('patient')}</label>
                <div className="font-bold text-gray-900 mt-1 truncate">{selectedPatient?.name}</div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t('branch')}</label>
                <div className="font-bold text-gray-900 mt-1 truncate">{activeBranch?.name ?? activeBranchId ?? '-'}</div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t('department')}</label>
                <div className="mt-1">
                  <Select
                    value={selectedDept}
                    onChange={(val) => {
                      setSelectedDept(val as Department);
                      setSelectedDoctor(null);
                      setSelectedTime('');
                    }}
                    options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t('date')}</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedDoctor(null);
                    setSelectedTime('');
                  }}
                  className="block w-full mt-1 text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('available_doctors')}</h3>
                <p className="text-xs text-gray-500">{t('choose_slot_hint')}</p>
              </div>

              {availabilityWarning && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {availabilityWarning}
                </div>
              )}

              {!activeBranchId ? (
                <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg border border-dashed border-amber-300">{t('no_doctors_without_branch')}</div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">{t('no_doctors')}</div>
              ) : doctors.map(renderDoctorRow)}
            </div>

            {selectedDoctor && selectedTime && (
              <div className="sticky bottom-0 bg-white/95 backdrop-blur border border-primary-100 rounded-xl p-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">{t('selected_slot')}</p>
                    <p className="font-bold text-gray-900">{selectedDoctor.name} • {formatTimeTo12Hour(selectedTime)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('CONFIRMATION')}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700"
                  >
                    {t('continue_to_confirmation')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'CONFIRMATION' && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 sm:p-6 text-center mb-5 sm:mb-6">
              <CheckCircle className="w-10 h-10 mx-auto text-green-600 mb-2" />
              <h3 className="text-2xl font-bold text-green-800 mb-1">{t('confirm_title')}</h3>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                <span className="text-gray-500 text-lg">{t('patient')}</span>
                <span className="font-bold text-xl text-right break-words">{selectedPatient?.name}</span>
              </div>
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                <span className="text-gray-500 text-lg">{t('service')}</span>
                <span className="font-bold text-xl text-right break-words">{selectedDept}</span>
              </div>
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                <span className="text-gray-500 text-lg">{t('doctor')}</span>
                <span className="font-bold text-xl text-right break-words max-w-[70%]">{selectedDoctor?.name}</span>
              </div>
              <div className="p-4 sm:p-5 flex items-start justify-between gap-3 bg-gray-50">
                <span className="text-gray-500 text-lg">{t('time')}</span>
                <span className="font-bold text-xl text-primary-700 text-right break-words">{selectedDate} @ {formatTimeTo12Hour(selectedTime)}</span>
              </div>
            </div>
            {bookingGuardMessage && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm font-medium">
                {bookingGuardMessage}
              </div>
            )}

            {/* Early check-in notice */}
            {patientLaterAppointment && (
              <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isEarlyCheckin ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isEarlyCheckin ? 'text-orange-600' : 'text-blue-500'}`} />
                  <div className="flex-1">
                    <p className={`font-semibold ${isEarlyCheckin ? 'text-orange-800' : 'text-blue-800'}`}>
                      هذا المريض لديه موعد لاحق اليوم
                    </p>
                    <p className={`mt-0.5 ${isEarlyCheckin ? 'text-orange-700' : 'text-blue-700'}`}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      الساعة {formatTimeTo12Hour(patientLaterAppointment.timeSlot)}
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEarlyCheckin}
                        onChange={(e) => setIsEarlyCheckin(e.target.checked)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <span className={`text-sm font-medium ${isEarlyCheckin ? 'text-orange-800' : 'text-blue-700'}`}>
                        المريض حضر مبكراً — إلغاء موعد الساعة {formatTimeTo12Hour(patientLaterAppointment.timeSlot)} بصمت (بدون إشعار)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setStep('SELECTION')} className="flex-1 py-3.5 border border-gray-300 rounded-lg font-medium text-2xl sm:text-xl hover:bg-gray-50">{t('back')}</button>
              <button onClick={handleConfirm} className="flex-[2] py-3.5 bg-primary-600 text-white rounded-lg font-bold text-xl hover:bg-primary-700 shadow-lg">{t('confirm_booking')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
