import React, { useState, useEffect } from 'react';
import { Appointment, Department, Patient, TimeSlot, User } from '../types';
import { BRANCHES, DEPARTMENTS, MOCK_USERS } from '../constants';
import { generateTimeSlots } from '../services/mockData';
import { PatientLookup } from '../components/PatientLookup';
import { CheckCircle, Calendar, ChevronRight, User as UserIcon, MapPin, Search, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AppointmentBookingProps {
    onBook: (apt: Partial<Appointment>) => void;
    patients: Patient[];
}

// Optimized steps: ID -> SELECTION (Doc+Slot) -> CONFIRM
type BookingStep = 'IDENTIFICATION' | 'SELECTION' | 'CONFIRMATION';

export const AppointmentBooking: React.FC<AppointmentBookingProps> = ({ onBook, patients }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<BookingStep>('IDENTIFICATION');

    // State
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0].id);
    const [selectedDept, setSelectedDept] = useState<Department>(Department.INTERNAL_MEDICINE);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Final Selection
    const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');

    // Handlers
    const handlePatientSelect = (patient: Patient) => {
        setSelectedPatient(patient);
        setStep('SELECTION');
    };

    const handlePatientCreate = (newPatientData: Partial<Patient>) => {
        const newPatient = {
            ...newPatientData,
            id: Math.random().toString(36).substr(2, 9),
            lastVisit: 'First Visit'
        } as Patient;
        setSelectedPatient(newPatient);
        setStep('SELECTION');
    };

    const handleSlotSelect = (doctor: User, time: string) => {
        setSelectedDoctor(doctor);
        setSelectedTime(time);
        setStep('CONFIRMATION');
    };

    const handleConfirm = () => {
        if (selectedPatient && selectedDoctor && selectedTime) {
            onBook({
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                doctorId: selectedDoctor.id,
                doctorName: selectedDoctor.name,
                branchId: selectedBranch,
                date: selectedDate,
                timeSlot: selectedTime,
                department: selectedDept,
                type: 'Consultation'
            });
            // Reset
            setStep('IDENTIFICATION');
            setSelectedPatient(null);
            setSelectedTime('');
            setSelectedDoctor(null);
        }
    };

    // Render Helpers
    const renderDoctorRow = (doctor: User) => {
        // Generate slots for this specific doctor and date
        const slots = generateTimeSlots(selectedDate, doctor.id).slice(0, 8); // Show first 8 for density

        return (
            <div key={doctor.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center w-full sm:w-64 flex-shrink-0">
                    <img src={doctor.avatarUrl} alt="" className="w-12 h-12 rounded-full bg-gray-100 object-cover" />
                    <div className="ml-3 sm:ms-3">
                        <p className="font-bold text-gray-900">{doctor.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{t(doctor.role as any)}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto w-full">
                    <div className="flex gap-2 pb-2 sm:pb-0">
                        {slots.map(slot => (
                            <button
                                key={slot.time}
                                disabled={!slot.available}
                                onClick={() => handleSlotSelect(doctor, slot.time)}
                                className={`
                                flex-shrink-0 px-3 py-2 rounded-md text-xs font-bold transition-colors border
                                ${slot.available
                                        ? 'bg-white border-primary-200 text-primary-700 hover:bg-primary-600 hover:text-white hover:border-primary-600'
                                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'}
                            `}
                            >
                                {slot.time}
                            </button>
                        ))}
                        {slots.filter(s => s.available).length === 0 && (
                            <span className="text-xs text-red-400 font-medium py-2">{t('no_slots')}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const doctors = MOCK_USERS.filter(u => u.role === 'DOCTOR' && u.specialty === selectedDept);

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-full max-h-[800px]">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 text-primary-600" />
                    {step === 'IDENTIFICATION' ? t('identification') : step === 'SELECTION' ? t('select_slot') : t('confirmation')}
                </h2>
                {step !== 'IDENTIFICATION' && (
                    <button onClick={() => setStep('IDENTIFICATION')} className="text-sm text-gray-500 hover:text-red-600">{t('cancel')}</button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">

                {/* STEP 1: ID */}
                {step === 'IDENTIFICATION' && (
                    <div className="max-w-2xl mx-auto">
                        <PatientLookup
                            patients={patients}
                            onSelectPatient={handlePatientSelect}
                            onAddNewPatient={handlePatientCreate}
                        />
                    </div>
                )}

                {/* STEP 2: FAST SELECTION GRID */}
                {step === 'SELECTION' && (
                    <div className="space-y-6">
                        {/* Filters Bar */}
                        <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">{t('patient')}</label>
                                <div className="font-bold text-gray-900 flex items-center">
                                    {selectedPatient?.name}
                                    <button onClick={() => setStep('IDENTIFICATION')} className="ml-2 rtl:mr-2 rtl:ml-0 text-primary-600 text-xs hover:underline">{t('change')}</button>
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">{t('branch')}</label>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="block w-full mt-1 text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white"
                                >
                                    {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">{t('department')}</label>
                                <select
                                    value={selectedDept}
                                    onChange={(e) => setSelectedDept(e.target.value as Department)}
                                    className="block w-full mt-1 text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-white"
                                >
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">{t('date')}</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="block w-full mt-1 text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>

                        {/* Availability Grid */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('available_doctors')}</h3>
                            {doctors.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    {t('no_doctors')}
                                </div>
                            ) : (
                                doctors.map(renderDoctorRow)
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 3: CONFIRM */}
                {step === 'CONFIRMATION' && (
                    <div className="max-w-md mx-auto">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
                            <h3 className="text-xl font-bold text-green-800 mb-1">{t('confirm_title')}</h3>
                            <p className="text-green-600 text-sm">{t('confirm_subtitle')}</p>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                            <div className="p-4 border-b border-gray-100 flex justify-between">
                                <span className="text-gray-500">{t('patient')}</span>
                                <span className="font-bold">{selectedPatient?.name}</span>
                            </div>
                            <div className="p-4 border-b border-gray-100 flex justify-between">
                                <span className="text-gray-500">{t('service')}</span>
                                <span className="font-bold">{selectedDept}</span>
                            </div>
                            <div className="p-4 border-b border-gray-100 flex justify-between">
                                <span className="text-gray-500">{t('doctor')}</span>
                                <span className="font-bold">{selectedDoctor?.name}</span>
                            </div>
                            <div className="p-4 flex justify-between bg-gray-50">
                                <span className="text-gray-500">{t('time')}</span>
                                <span className="font-bold text-primary-700">{selectedDate} @ {selectedTime}</span>
                            </div>
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