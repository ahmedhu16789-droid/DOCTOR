import React, { useState, useEffect } from 'react';
import { Appointment, Department, Patient } from '../types';
import { BRANCHES, DEPARTMENTS, MOCK_USERS } from '../constants';
import { generateTimeSlots, MOCK_PATIENTS } from '../services/mockData';
import { Calendar, MapPin, Search, Star, Clock, ArrowRight, Phone, CheckCircle, UserPlus, User, ChevronLeft, CreditCard, Banknote } from 'lucide-react';

interface PublicBookingProps {
  onBackToLogin: () => void;
}

export const PublicBooking: React.FC<PublicBookingProps> = ({ onBackToLogin }) => {
  // Flow State
  const [step, setStep] = useState<'SEARCH' | 'SLOT_SELECTION' | 'AUTH' | 'CONFIRM'>('SEARCH');
  
  // Selection State
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0].id);
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

  // Data
  const doctors = MOCK_USERS.filter(u => u.role === 'DOCTOR' && u.specialty === selectedDept && u.assignedBranches.includes(selectedBranch));

  const handleSlotClick = (doc: any, time: string) => {
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

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API lookup
    const found = MOCK_PATIENTS.filter(p => p.phone === phone);
    setLinkedProfiles(found);
    setAuthStep('PROFILE');
  };

  const handleProfileSelect = (p: Patient) => {
    setSelectedPatient(p);
    setStep('CONFIRM');
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
    setStep('CONFIRM');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
              AF
            </div>
            <span className="font-bold text-lg text-gray-800">Al-Fath Clinic</span>
          </div>
          <button onClick={onBackToLogin} className="text-sm text-gray-500 hover:text-primary-600">
            Staff Login
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* PROGRESS BAR */}
        <div className="flex items-center justify-between mb-8 px-2">
           {['Service', 'Doctor & Time', 'Your Info', 'Done'].map((label, idx) => {
             const steps = ['SEARCH', 'SLOT_SELECTION', 'AUTH', 'CONFIRM'];
             const currentIdx = steps.indexOf(step);
             return (
               <div key={label} className={`flex flex-col items-center ${idx <= currentIdx ? 'text-primary-600' : 'text-gray-300'}`}>
                  <div className={`w-3 h-3 rounded-full mb-1 ${idx <= currentIdx ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                  <span className="text-xs font-medium">{label}</span>
               </div>
             )
           })}
        </div>

        {/* STEP 1: SEARCH */}
        {step === 'SEARCH' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            <h1 className="text-2xl font-bold text-center mb-6">Book Your Appointment</h1>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Branch</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BRANCHES.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranch(b.id)}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      selectedBranch === b.id 
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <MapPin className={`w-5 h-5 mb-2 ${selectedBranch === b.id ? 'text-primary-600' : 'text-gray-400'}`} />
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-xs text-gray-500">{b.location}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Department</label>
              <select 
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as Department)}
                className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-3 text-lg"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <button 
              onClick={() => setStep('SLOT_SELECTION')}
              className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all flex items-center justify-center"
            >
              Find Doctors <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        )}

        {/* STEP 2: SLOT SELECTION */}
        {step === 'SLOT_SELECTION' && (
          <div className="space-y-4">
             <button onClick={() => setStep('SEARCH')} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to filters
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
                 const slots = generateTimeSlots(selectedDate, doc.id).filter(s => s.available).slice(0, 5);
                 return (
                   <div key={doc.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center">
                             <img src={doc.avatarUrl} alt="" className="w-14 h-14 rounded-full bg-gray-100 object-cover" />
                             <div className="ml-4">
                                <h3 className="font-bold text-lg text-gray-900">{doc.name}</h3>
                                <div className="flex items-center text-yellow-500 text-sm">
                                   <Star className="w-4 h-4 fill-current" />
                                   <span className="ml-1 font-medium">4.8</span>
                                   <span className="text-gray-300 mx-2">•</span>
                                   <span className="text-gray-500">{doc.specialty}</span>
                                </div>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="text-lg font-bold text-primary-600">{doc.consultationFee} EGP</div>
                             <div className="text-xs text-gray-400">Consultation Fee</div>
                         </div>
                      </div>
                      
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Available Times Today</p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map(slot => (
                            <button
                              key={slot.time}
                              onClick={() => handleSlotClick(doc, slot.time)}
                              className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold hover:bg-primary-600 hover:text-white transition-colors border border-primary-100"
                            >
                              {slot.time}
                            </button>
                          ))}
                          {slots.length === 0 && (
                            <span className="text-sm text-gray-400 italic">No slots available today</span>
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
                <ChevronLeft className="w-4 h-4 mr-1" /> Change Time
             </button>

             <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
                <div className="flex justify-between items-center text-sm mb-1">
                   <span className="text-gray-500">Doctor</span>
                   <span className="font-bold text-gray-900">{selectedDoctor?.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-1">
                   <span className="text-gray-500">Time</span>
                   <span className="font-bold text-primary-700">{selectedDate} @ {selectedSlot}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-primary-100 pt-2 mt-2">
                   <span className="text-gray-500">Visit Fee</span>
                   <span className="font-bold text-gray-900">{selectedDoctor?.consultationFee} EGP</span>
                </div>
             </div>

             {authStep === 'PHONE' && (
               <form onSubmit={handlePhoneSubmit}>
                 <h3 className="text-xl font-bold mb-4">Enter Mobile Number</h3>
                 <p className="text-sm text-gray-500 mb-4">We will send you a verification code.</p>
                 <div className="relative mb-6">
                    <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <input 
                      type="tel" 
                      required
                      placeholder="01xxxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                      autoFocus
                    />
                 </div>
                 <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
                   Send Code
                 </button>
               </form>
             )}

             {authStep === 'OTP' && (
               <form onSubmit={handleOtpSubmit}>
                 <h3 className="text-xl font-bold mb-4">Verify Phone</h3>
                 <p className="text-sm text-gray-500 mb-4">Enter the code sent to {phone}</p>
                 <input 
                    type="text" 
                    placeholder="1234"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full text-center tracking-[1em] py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-2xl font-bold mb-6"
                    autoFocus
                  />
                 <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
                   Verify
                 </button>
               </form>
             )}

             {authStep === 'PROFILE' && (
               <div>
                  <h3 className="text-xl font-bold mb-4">Who is the patient?</h3>
                  
                  {!isCreatingProfile ? (
                    <div className="space-y-3">
                       {linkedProfiles.map(p => (
                         <button 
                           key={p.id}
                           onClick={() => handleProfileSelect(p)}
                           className="w-full flex items-center p-3 border border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
                         >
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mr-3">
                               <User className="w-5 h-5" />
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
                          <UserPlus className="w-5 h-5 mr-2" />
                          New Family Member
                       </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                       <div>
                         <label className="text-sm text-gray-600">Full Name</label>
                         <input 
                           type="text" 
                           value={newProfileName}
                           onChange={(e) => setNewProfileName(e.target.value)}
                           className="w-full p-2 border rounded-lg"
                         />
                       </div>
                       <div>
                         <label className="text-sm text-gray-600">Age</label>
                         <input 
                           type="number" 
                           value={newProfileAge}
                           onChange={(e) => setNewProfileAge(e.target.value)}
                           className="w-full p-2 border rounded-lg"
                         />
                       </div>
                       <div className="flex gap-2 mt-4">
                          <button onClick={() => setIsCreatingProfile(false)} className="flex-1 py-2 border rounded-lg">Cancel</button>
                          <button onClick={handleCreateProfile} className="flex-1 py-2 bg-primary-600 text-white rounded-lg">Save</button>
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
             <h2 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
             <p className="text-gray-600 mb-8">We have sent the details to {phone}</p>
             
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto text-left space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                   <span className="text-gray-500">Amount Due</span>
                   <span className="font-bold text-lg text-primary-700">{selectedDoctor?.consultationFee} EGP</span>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                    <p className="font-bold mb-1">Note:</p>
                    Additional fees may apply if any medical procedures or tests are performed during the visit.
                </div>

                <div>
                   <label className="text-xs text-gray-400 uppercase tracking-wider">Patient</label>
                   <p className="font-bold text-gray-900">{selectedPatient?.name}</p>
                </div>
                <div>
                   <label className="text-xs text-gray-400 uppercase tracking-wider">Doctor</label>
                   <p className="font-bold text-gray-900">{selectedDoctor?.name}</p>
                   <p className="text-sm text-gray-500">{selectedDoctor?.specialty}</p>
                </div>
                <div>
                   <label className="text-xs text-gray-400 uppercase tracking-wider">Time</label>
                   <p className="font-bold text-green-700">{selectedDate} at {selectedSlot}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                    <button onClick={() => setPayOnline(!payOnline)} className="w-full flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                        <span className="flex items-center gap-2">
                             {payOnline ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                             {payOnline ? "Pay Online Now" : "Pay at Clinic"}
                        </span>
                        <span className="text-primary-600 text-sm font-bold">Change</span>
                    </button>
                </div>
             </div>

             <button onClick={() => window.location.reload()} className="mt-8 text-primary-600 font-medium hover:underline">
                Book Another Appointment
             </button>
          </div>
        )}

      </main>
    </div>
  );
};