import React, { useEffect, useMemo, useState } from 'react';
import { Department, Patient, TimeSlot, User } from '../types';
import { BRANCHES, DEPARTMENTS } from '../constants';
import { MapPin, Star, ArrowRight, Phone, CheckCircle, UserPlus, User as UserIcon, ChevronLeft, CreditCard, Banknote } from 'lucide-react';
import { Select } from '../components/common/Select';
import { useTranslation } from 'react-i18next';
import { formatTimeTo12Hour } from '../utils/time';
import { getPublicBookingRepository, PublicBookingMode } from '../services/publicBookingRepository';

interface PublicBookingProps {
  onBackToLogin: () => void;
}

export const PublicBooking: React.FC<PublicBookingProps> = ({ onBackToLogin }) => {
  const { t } = useTranslation();
  const envMode = import.meta.env.VITE_PUBLIC_BOOKING_MODE === 'backend' ? 'backend' : 'demo';
  const [mode, setMode] = useState<PublicBookingMode>(envMode);
  const bookingRepository = useMemo(() => getPublicBookingRepository(mode), [mode]);

  // Flow State
  const [step, setStep] = useState<'SEARCH' | 'SLOT_SELECTION' | 'AUTH' | 'CONFIRM'>('SEARCH');

  // Selection State
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0].id);
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [slotsByDoctor, setSlotsByDoctor] = useState<Record<string, TimeSlot[]>>({});
  const [bookingError, setBookingError] = useState('');

  // Auth State
  const [phone, setPhone] = useState('');
  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
  const [otp, setOtp] = useState('');
  const [linkedProfiles, setLinkedProfiles] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New Profile State
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAge, setNewProfileAge] = useState('');

  // Payment Selection
  const [payOnline, setPayOnline] = useState(false);

  useEffect(() => {
    bookingRepository
      .getDoctors({ branchId: selectedBranch, specialty: selectedDept })
      .then((payload) => setDoctors(payload))
      .catch(() => setDoctors([]));
  }, [bookingRepository, selectedBranch, selectedDept]);

  useEffect(() => {
    if (doctors.length === 0) {
      setSlotsByDoctor({});
      return;
    }

    if (bookingRepository.getSlotsBulk) {
      bookingRepository
        .getSlotsBulk({
          doctorIds: doctors.map((doctor) => doctor.id),
          branchId: selectedBranch,
          date: selectedDate,
        })
        .then((payload) => setSlotsByDoctor(payload))
        .catch(() => setSlotsByDoctor({}));
      return;
    }

    Promise.all(
      doctors.map(async (doctor) => {
        const slots = await bookingRepository.getSlots({
          doctorId: doctor.id,
          branchId: selectedBranch,
          date: selectedDate,
        });
        return [doctor.id, slots] as const;
      }),
    )
      .then((entries) => setSlotsByDoctor(Object.fromEntries(entries)))
      .catch(() => setSlotsByDoctor({}));
  }, [bookingRepository, doctors, selectedBranch, selectedDate]);

  const handleSlotClick = (doc: User, time: string) => {
    setSelectedDoctor(doc);
    setSelectedSlot(time);
    setStep('AUTH');
    setAuthStep('PHONE');
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length > 8) {
      setAuthStep('OTP');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = await bookingRepository.lookupPatientsByPhone(phone);
    setLinkedProfiles(found);
    setAuthStep('PROFILE');
  };

  const proceedToConfirmation = async (patient: Patient) => {
    if (!selectedDoctor) return;

    setBookingError('');
    try {
      await bookingRepository.createAppointment({
        patient,
        doctor: selectedDoctor,
        branchId: selectedBranch,
        date: selectedDate,
        timeSlot: selectedSlot,
      });
      setSelectedPatient(patient);
      setStep('CONFIRM');
    } catch {
      setBookingError(mode === 'backend' ? 'تعذر إنشاء الحجز على الخادم. تحقق من البيانات ثم أعد المحاولة.' : 'تعذر تأكيد الحجز التجريبي.');
    }
  };

  const handleProfileSelect = (p: Patient) => {
    setSelectedPatient(p);
    void proceedToConfirmation(p);
  };

  const handleCreateProfile = () => {
    const newP: Patient = {
      id: Math.random().toString(),
      name: newProfileName,
      age: parseInt(newProfileAge),
      gender: 'Male', // simplified for public demo
      phone: phone,
      lastVisit: '',
      medicalHistorySummary: 'Self registered',
      balance: 0
    };
    setSelectedPatient(newP);
    void proceedToConfirmation(newP);
  };

  const steps = [
    { id: 'SEARCH', label: t('steps.service') },
    { id: 'SLOT_SELECTION', label: t('steps.doctor_time') },
    { id: 'AUTH', label: t('steps.your_info') },
    { id: 'CONFIRM', label: t('steps.done') }
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
              AF
            </div>
            <span className="font-bold text-lg text-gray-800">{t('clinic_name')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-36">
              <Select
                value={mode}
                onChange={(val) => setMode(val as PublicBookingMode)}
                options={[
                  { value: 'demo', label: 'Demo mode' },
                  { value: 'backend', label: 'Backend mode' }
                ]}
              />
            </div>
            <button onClick={onBackToLogin} className="text-sm text-gray-500 hover:text-primary-600">
              {t('staff_login')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* PROGRESS BAR */}
        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((s, idx) => {
            const stepIds = ['SEARCH', 'SLOT_SELECTION', 'AUTH', 'CONFIRM'];
            const currentIdx = stepIds.indexOf(step);
            return (
              <div key={s.id} className={`flex flex-col items-center ${idx <= currentIdx ? 'text-primary-600' : 'text-gray-300'}`}>
                <div className={`w-3 h-3 rounded-full mb-1 ${idx <= currentIdx ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                <span className="text-xs font-medium">{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* STEP 1: SEARCH */}
        {step === 'SEARCH' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            <h1 className="text-2xl font-bold text-center mb-6">{t('book_your_appointment')}</h1>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_branch')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BRANCHES.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranch(b.id)}
                    className={`p-4 border rounded-xl text-left transition-all ${selectedBranch === b.id
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <MapPin className={`w-5 h-5 mb-2 rtl:ml-2 rtl:mr-0 ${selectedBranch === b.id ? 'text-primary-600' : 'text-gray-400'}`} />
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-xs text-gray-500">{b.location}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_department')}</label>
              <Select
                value={selectedDept}
                onChange={(val) => setSelectedDept(val as Department)}
                options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
              />
            </div>

            <button
              onClick={() => setStep('SLOT_SELECTION')}
              className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all flex items-center justify-center"
            >
              {t('find_doctors')} <ArrowRight className="ml-2 w-5 h-5 rtl:mr-2 rtl:ml-0 rtl:rotate-180" />
            </button>
          </div>
        )}

        {/* STEP 2: SLOT SELECTION */}
        {step === 'SLOT_SELECTION' && (
          <div className="space-y-4">
            <button onClick={() => setStep('SEARCH')} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2">
              <ChevronLeft className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0 rtl:rotate-180" /> {t('back_to_filters')}
            </button>

            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 mb-4 sticky top-20 z-10 shadow-sm">
              <div>
                <h2 className="font-bold text-gray-900">{selectedDept}</h2>
                <p className="text-sm text-gray-500">{BRANCHES.find(b => b.id === selectedBranch)?.name}</p>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-gray-200 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-4">
              {doctors.map(doc => {
                const slots = (slotsByDoctor[doc.id] ?? []).filter(s => s.available).slice(0, 5);
                return (
                  <div key={doc.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <img src={doc.avatarUrl} alt="" className="w-14 h-14 rounded-full bg-gray-100 object-cover" />
                        <div className="ml-4 rtl:mr-4 rtl:ml-0">
                          <h3 className="font-bold text-lg text-gray-900">{doc.name}</h3>
                          <div className="flex items-center text-yellow-500 text-sm">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="ml-1 font-medium rtl:mr-1 rtl:ml-0">4.8</span>
                            <span className="text-gray-300 mx-2">•</span>
                            <span className="text-gray-500">{doc.specialty}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right rtl:text-left">
                        <div className="text-lg font-bold text-primary-600">{doc.consultationFee} EGP</div>
                        <div className="text-xs text-gray-400">{t('consultation_fee')}</div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('available_times_today')}</p>
                      <div className="flex flex-wrap gap-2">
                        {slots.map(slot => (
                          <button
                            key={slot.time}
                            onClick={() => handleSlotClick(doc, slot.time)}
                            className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold hover:bg-primary-600 hover:text-white transition-colors border border-primary-100"
                          >
                            {formatTimeTo12Hour(slot.time)}
                          </button>
                        ))}
                        {slots.length === 0 && (
                          <span className="text-sm text-gray-400 italic">{t('no_slots_today')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 3: AUTH */}
        {step === 'AUTH' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 max-w-md mx-auto">
            <button onClick={() => { setStep('SLOT_SELECTION'); setAuthStep('PHONE'); }} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6">
              <ChevronLeft className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0 rtl:rotate-180" /> {t('change_time')}
            </button>

            <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-gray-500">{t('doctor')}</span>
                <span className="font-bold text-gray-900">{selectedDoctor?.name}</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-gray-500">{t('time')}</span>
                <span className="font-bold text-primary-700">{selectedDate} @ {formatTimeTo12Hour(selectedSlot)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-primary-100 pt-2 mt-2">
                <span className="text-gray-500">{t('visit_fee')}</span>
                <span className="font-bold text-gray-900">{selectedDoctor?.consultationFee} EGP</span>
              </div>
            </div>

            {authStep === 'PHONE' && (
              <form onSubmit={handlePhoneSubmit}>
                <h3 className="text-xl font-bold mb-4">{t('enter_mobile')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('verification_code_sent')}</p>
                <div className="relative mb-6">
                  <Phone className="absolute left-3 top-3.5 rtl:right-3 rtl:left-auto text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg rtl:pl-4 rtl:pr-10 text-start direction-ltr"
                    autoFocus
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
                  {t('send_code')}
                </button>
              </form>
            )}

            {authStep === 'OTP' && (
              <form onSubmit={handleOtpSubmit}>
                <h3 className="text-xl font-bold mb-4">{t('verify_phone')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('enter_code_sent_to')} {phone}</p>
                <input
                  type="text"
                  placeholder="1234"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full text-center tracking-[1em] py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-2xl font-bold mb-6"
                  autoFocus
                />
                <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
                  {t('verify')}
                </button>
              </form>
            )}

            {authStep === 'PROFILE' && (
              <div>
                <h3 className="text-xl font-bold mb-4">{t('who_is_patient')}</h3>

                {bookingError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {bookingError}
                  </div>
                )}

                {!isCreatingProfile ? (
                  <div className="space-y-3">
                    {linkedProfiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleProfileSelect(p)}
                        className="w-full flex items-center p-3 border border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mr-3 rtl:ml-3 rtl:mr-0">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.age} years • {p.gender}</div>
                        </div>
                      </button>
                    ))}

                    <button
                      onClick={() => setIsCreatingProfile(true)}
                      className="w-full flex items-center justify-center p-3 border border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-primary-600 hover:border-primary-500 hover:bg-gray-50"
                    >
                      <UserPlus className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                      {t('new_family_member')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-600">{t('full_name')}</label>
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">{t('age')}</label>
                      <input
                        type="number"
                        value={newProfileAge}
                        onChange={(e) => setNewProfileAge(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => setIsCreatingProfile(false)} className="flex-1 py-2 border rounded-lg">{t('cancel')}</button>
                      <button onClick={handleCreateProfile} className="flex-1 py-2 bg-primary-600 text-white rounded-lg">{t('save')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: CONFIRM */}
        {step === 'CONFIRM' && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('booking_confirmed')}</h2>
            <p className="text-gray-600 mb-8">{t('details_sent_to')} {phone}</p>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-left space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <span className="text-gray-500">{t('amount_due')}</span>
                <span className="font-bold text-lg text-primary-700">{selectedDoctor?.consultationFee} EGP</span>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                <p className="font-bold mb-1">{t('note')}</p>
                {t('additional_fees_notice')}
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider">{t('patient')}</label>
                <p className="font-bold text-gray-900">{selectedPatient?.name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider">{t('doctor')}</label>
                <p className="font-bold text-gray-900">{selectedDoctor?.name}</p>
                <p className="text-sm text-gray-500">{selectedDoctor?.specialty}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider">{t('time')}</label>
                <p className="font-bold text-green-700">{selectedDate} @ {formatTimeTo12Hour(selectedSlot)}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100">
                <button onClick={() => setPayOnline(!payOnline)} className="w-full flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                  <span className="flex items-center gap-2">
                    {payOnline ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                    {payOnline ? t('pay_online') : t('pay_at_clinic')}
                  </span>
                  <span className="text-primary-600 text-sm font-bold">{t('change')}</span>
                </button>
              </div>
            </div>

            <button onClick={() => window.location.reload()} className="mt-8 text-primary-600 font-medium hover:underline">
              {t('book_another')}
            </button>
          </div>
        )}

      </main>
    </div>
  );
};
