import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, Branch, Department, Patient, User } from '../types';
import { DEPARTMENTS } from '../constants';
import { PatientLookup } from '../components/PatientLookup';
import { CheckCircle, Calendar, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createPatientViaApi, getAvailableSlotsBulkFromApi, getDoctorsFromApi, lookupPatientsByPhoneFromApi } from '../services/api';

interface AppointmentBookingProps {
  onBook: (apt: Partial<Appointment>) => void;
  patients: Patient[];
  branches: Branch[];
  activeBranchId: string;
  onPatientCreated: (patient: Patient) => void;
}

type BookingStep = 'IDENTIFICATION' | 'SELECTION' | 'CONFIRMATION';

export const AppointmentBooking: React.FC<AppointmentBookingProps> = ({ onBook, patients, branches, activeBranchId, onPatientCreated }) => {
  const { t } = useTranslation();

  const [step, setStep] = useState<BookingStep>('IDENTIFICATION');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department>(Department.INTERNAL_MEDICINE);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [doctors, setDoctors] = useState<User[]>([]);
  const [slotsByDoctor, setSlotsByDoctor] = useState<Record<string, { time: string; available: boolean }[]>>({});

  const activeBranch = useMemo(() => branches.find((branch) => branch.id === activeBranchId), [activeBranchId, branches]);

  useEffect(() => {
    if (!activeBranchId) return;

    getDoctorsFromApi({ branchId: activeBranchId, specialty: selectedDept })
      .then((payload) => setDoctors(payload))
      .catch(() => setDoctors([]));
  }, [activeBranchId, selectedDept]);

  useEffect(() => {
    if (!activeBranchId || doctors.length === 0) {
      setSlotsByDoctor({});
      return;
    }

    getAvailableSlotsBulkFromApi({
      doctorIds: doctors.map((doctor) => doctor.id),
      branchId: activeBranchId,
      date: selectedDate,
    })
      .then((payload) => setSlotsByDoctor(payload))
      .catch(() => setSlotsByDoctor({}));
  }, [doctors, activeBranchId, selectedDate]);

  const handlePatientCreate = async (newPatientData: Partial<Patient>) => {
    console.log('handlePatientCreate: Called with', newPatientData);
    const created = await createPatientViaApi({
      name: newPatientData.name ?? '',
      phone: newPatientData.phone ?? '',
      age: newPatientData.age ?? 0,
      gender: (newPatientData.gender as 'Male' | 'Female') ?? 'Male',
      medicalHistorySummary: newPatientData.medicalHistorySummary,
    });
    console.log('handlePatientCreate: API returned', created);

    onPatientCreated(created);

    return created;
  };

  const handleConfirm = () => {
    if (selectedPatient && selectedDoctor && selectedTime && activeBranchId) {
      onBook({
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        branchId: activeBranchId,
        date: selectedDate,
        timeSlot: selectedTime,
        department: selectedDept,
        type: 'Consultation'
      });
      setStep('IDENTIFICATION');
      setSelectedPatient(null);
      setSelectedTime('');
      setSelectedDoctor(null);
    }
  };

  const renderDoctorRow = (doctor: User) => {
    const slots = slotsByDoctor[doctor.id] ?? [];

    return (
      <div key={doctor.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center w-full sm:w-64 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="ml-3 sm:ms-3">
            <p className="font-bold text-gray-900">{doctor.name}</p>
            <p className="text-xs text-gray-500 capitalize">{doctor.specialty}</p>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto w-full">
          <div className="flex gap-2 pb-2 sm:pb-0">
            {slots.map(slot => (
              <button
                key={`${doctor.id}-${slot.time}`}
                disabled={!slot.available}
                onClick={() => {
                  setSelectedDoctor(doctor);
                  setSelectedTime(slot.time);
                  setStep('CONFIRMATION');
                }}
                className={`flex-shrink-0 px-3 py-2 rounded-md text-xs font-bold transition-colors border ${slot.available
                  ? 'bg-white border-primary-200 text-primary-700 hover:bg-primary-600 hover:text-white hover:border-primary-600'
                  : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'}`}
              >
                {slot.time}
              </button>
            ))}
            {slots.filter((slot) => slot.available).length === 0 && (
              <span className="text-xs text-red-400 font-medium py-2">{t('no_slots')}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-full max-h-[800px]">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Calendar className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 text-primary-600" />
          {step === 'IDENTIFICATION' ? t('identification') : step === 'SELECTION' ? t('select_slot') : t('confirmation')}
        </h2>
        {step !== 'IDENTIFICATION' && (
          <button onClick={() => setStep('IDENTIFICATION')} className="text-sm text-gray-500 hover:text-primary-600">{t('change')}</button>
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
            onSearchByPhone={lookupPatientsByPhoneFromApi}
          />
        )}

        {step === 'SELECTION' && (
          <div className="space-y-6">
            {!activeBranchId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm">
                لا يوجد فرع فعال لهذا المستخدم في الشيفت الحالي. برجاء ربط موظف الاستقبال بفرع/شيفت قبل الحجز.
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('patient')}</label>
                <div className="font-bold text-gray-900">{selectedPatient?.name}</div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('branch')}</label>
                <div className="font-bold text-gray-900">{activeBranch?.name ?? activeBranchId ?? '-'}</div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('department')}</label>
                <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value as Department)} className="block w-full mt-1 text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white">
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('date')}</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="block w-full mt-1 text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('available_doctors')}</h3>
              {!activeBranchId ? (
                <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg border border-dashed border-amber-300">لا يمكن تحميل الأطباء بدون فرع فعال.</div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">{t('no_doctors')}</div>
              ) : doctors.map(renderDoctorRow)}
            </div>
          </div>
        )}

        {step === 'CONFIRMATION' && (
          <div className="max-w-md mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
              <CheckCircle className="w-10 h-10 mx-auto text-green-600 mb-2" />
              <h3 className="text-xl font-bold text-green-800 mb-1">{t('confirm_title')}</h3>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 flex justify-between"><span className="text-gray-500">{t('patient')}</span><span className="font-bold">{selectedPatient?.name}</span></div>
              <div className="p-4 border-b border-gray-100 flex justify-between"><span className="text-gray-500">{t('service')}</span><span className="font-bold">{selectedDept}</span></div>
              <div className="p-4 border-b border-gray-100 flex justify-between"><span className="text-gray-500">{t('doctor')}</span><span className="font-bold">{selectedDoctor?.name}</span></div>
              <div className="p-4 flex justify-between bg-gray-50"><span className="text-gray-500">{t('time')}</span><span className="font-bold text-primary-700">{selectedDate} @ {selectedTime}</span></div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep('SELECTION')} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">{t('back')}</button>
              <button onClick={handleConfirm} className="flex-[2] py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-lg">{t('confirm_booking')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
