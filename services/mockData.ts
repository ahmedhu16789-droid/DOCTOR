import { Appointment, AppointmentStatus, Department, Patient, TimeSlot, Medication, ServiceItem, PaymentStatus, WeeklyShift, Employee, UserRole, PaymentMethod } from '../types';
import { BRANCHES } from '../constants';

// --- Schedules ---
// Dr. Sarah: Mon/Wed (Branch 1), Tue/Thu (Branch 2)
export const MOCK_SCHEDULES: Record<string, WeeklyShift[]> = {
  'u1': [
    { id: 's1', dayOfWeek: 1, startTime: '09:00', endTime: '14:00', branchId: 'b1', slotDuration: 20 }, // Mon
    { id: 's2', dayOfWeek: 3, startTime: '09:00', endTime: '14:00', branchId: 'b1', slotDuration: 20 }, // Wed
    { id: 's3', dayOfWeek: 2, startTime: '14:00', endTime: '18:00', branchId: 'b2', slotDuration: 30 }, // Tue
    { id: 's4', dayOfWeek: 4, startTime: '14:00', endTime: '18:00', branchId: 'b2', slotDuration: 30 }, // Thu
  ],
  'u3': [
     { id: 's5', dayOfWeek: 0, startTime: '10:00', endTime: '16:00', branchId: 'b1', slotDuration: 15 }, // Sun
     { id: 's6', dayOfWeek: 1, startTime: '10:00', endTime: '16:00', branchId: 'b1', slotDuration: 15 }, // Mon
     { id: 's7', dayOfWeek: 2, startTime: '10:00', endTime: '16:00', branchId: 'b1', slotDuration: 15 }, // Tue
  ]
};

export const MOCK_SERVICES: ServiceItem[] = [
  { id: 'srv_cns', name: 'Specialist Consultation', price: 400, category: 'CONSULTATION', department: Department.CARDIOLOGY },
  { id: 'srv_fol', name: 'Follow-up Visit', price: 150, category: 'CONSULTATION', department: Department.CARDIOLOGY },
  { id: 'srv_ecg', name: 'ECG (Electrocardiogram)', price: 200, category: 'PROCEDURE', department: Department.CARDIOLOGY },
  { id: 'srv_ultra', name: 'Ultrasound Scan', price: 350, category: 'PROCEDURE', department: Department.INTERNAL_MEDICINE },
  { id: 'srv_dress', name: 'Wound Dressing', price: 100, category: 'PROCEDURE' },
  { id: 'srv_inj', name: 'IM Injection', price: 50, category: 'PROCEDURE' },
  { id: 'srv_cast', name: 'Plaster Cast (Arm)', price: 500, category: 'PROCEDURE', department: Department.ORTHOPEDICS },
  { id: 'srv_lab_bc', name: 'Blood Glucose Test', price: 80, category: 'LAB' },
];

export const MOCK_PATIENTS: Patient[] = [
  { 
    id: 'p1', 
    name: 'Ahmed Mahmoud', 
    age: 45, 
    gender: 'Male', 
    phone: '01001234567', 
    lastVisit: '2023-10-15', 
    medicalHistorySummary: 'Hypertension, Diabetic Type 2',
    allergies: ['Penicillin', 'Peanuts'],
    chronicConditions: ['Hypertension', 'Diabetes T2'],
    balance: 0
  },
  { 
    id: 'p2', 
    name: 'Layla Hassan', 
    age: 28, 
    gender: 'Female', 
    phone: '01119876543', 
    lastVisit: '2023-11-01', 
    medicalHistorySummary: 'Asthma, Penicillin Allergy',
    allergies: ['Dust Mites', 'Aspirin'],
    chronicConditions: ['Asthma'],
    balance: 150
  },
  { id: 'p3', name: 'Ibrahim Youssef', age: 42, gender: 'Male', phone: '01223334444', lastVisit: '2023-11-20', medicalHistorySummary: 'None', balance: 0 },
];

export const MOCK_EMPLOYEES: Employee[] = [
    {
        id: 'e1',
        name: 'Nurse Amani',
        role: UserRole.NURSE,
        jobTitle: 'Senior Nurse',
        assignedBranches: ['b1'],
        email: 'amani@alfath.com',
        phone: '0100000001',
        status: 'ACTIVE',
        payroll: { model: 'FIXED_SALARY', baseSalary: 4000, effectiveDate: '2023-01-01' }
    },
    {
        id: 'e2',
        name: 'Receptionist Mona',
        role: UserRole.RECEPTIONIST,
        jobTitle: 'Front Desk',
        assignedBranches: ['b1', 'b2'],
        email: 'mona@alfath.com',
        phone: '0100000002',
        status: 'ACTIVE',
        payroll: { model: 'FIXED_SALARY', baseSalary: 3500, effectiveDate: '2023-01-01' }
    }
];

const today = new Date().toISOString().split('T')[0];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt1',
    patientId: 'p1',
    patientName: 'Ahmed Mahmoud',
    doctorId: 'u1',
    doctorName: 'Dr. Sarah Ahmed',
    branchId: 'b1',
    date: today,
    timeSlot: '09:00',
    department: Department.CARDIOLOGY,
    status: AppointmentStatus.IN_PROGRESS,
    type: 'Consultation',
    notes: 'Checking BP medication',
    createdAt: new Date().toISOString(),
    billing: {
      items: [
        { id: '1', serviceId: 'srv_cns', name: 'Specialist Consultation', quantity: 1, unitPrice: 400, total: 400, addedBy: 'system', timestamp: today }
      ],
      subtotal: 400,
      discount: 0,
      total: 400,
      paidAmount: 0,
      status: PaymentStatus.UNPAID,
      transactions: []
    }
  },
  {
    id: 'apt2',
    patientId: 'p2',
    patientName: 'Layla Hassan',
    doctorId: 'u1',
    doctorName: 'Dr. Sarah Ahmed',
    branchId: 'b1',
    date: today,
    timeSlot: '09:40',
    department: Department.CARDIOLOGY,
    status: AppointmentStatus.WAITING,
    type: 'Follow-up',
    createdAt: new Date().toISOString(),
    billing: {
      items: [
        { id: '2', serviceId: 'srv_fol', name: 'Follow-up Visit', quantity: 1, unitPrice: 150, total: 150, addedBy: 'system', timestamp: today }
      ],
      subtotal: 150,
      discount: 0,
      total: 150,
      paidAmount: 150,
      status: PaymentStatus.PAID,
      transactions: [
        { id: 'tx1', amount: 150, method: PaymentMethod.CASH, timestamp: today, recordedBy: 'u2', reference: 'REC-001', type: 'PAYMENT' }
      ]
    }
  },
  {
    id: 'apt3',
    patientId: 'p3',
    patientName: 'Ibrahim Youssef',
    doctorId: 'u3',
    doctorName: 'Dr. Kareem Ezz',
    branchId: 'b1',
    date: today,
    timeSlot: '10:00',
    department: Department.ORTHOPEDICS,
    status: AppointmentStatus.SCHEDULED,
    type: 'Consultation',
    createdAt: new Date().toISOString(),
    billing: {
      items: [
        { id: '3', serviceId: 'srv_cns', name: 'Specialist Consultation', quantity: 1, unitPrice: 400, total: 400, addedBy: 'system', timestamp: today }
      ],
      subtotal: 400,
      discount: 0,
      total: 400,
      paidAmount: 0,
      status: PaymentStatus.UNPAID,
      transactions: []
    }
  }
];

export const MOCK_MEDICATIONS: Medication[] = [
    { id: 'm1', name: 'Panadol Extra', dosage: '500mg', frequency: 'TID', duration: '5 days' },
    { id: 'm2', name: 'Augmentin', dosage: '1g', frequency: 'BID', duration: '7 days' },
    { id: 'm3', name: 'Cataflam', dosage: '50mg', frequency: 'PRN', duration: '3 days' },
    { id: 'm4', name: 'Concor', dosage: '5mg', frequency: 'OD', duration: '30 days' },
    { id: 'm5', name: 'Insulin Lantus', dosage: '20 units', frequency: 'OD', duration: 'Continuous' },
];

export const getAppointments = (): Promise<Appointment[]> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_APPOINTMENTS), 300); 
  });
};

export const getPatients = (): Promise<Patient[]> => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(MOCK_PATIENTS), 200);
    });
};

export const getEmployees = (): Promise<Employee[]> => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(MOCK_EMPLOYEES), 250);
    })
}

// --- AVAILABILITY ENGINE ---

const addMinutes = (time: string, mins: number): string => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  date.setMinutes(date.getMinutes() + mins);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const isTimeBefore = (t1: string, t2: string) => {
    return parseInt(t1.replace(':', '')) < parseInt(t2.replace(':', ''));
};

export const generateTimeSlots = (dateStr: string, doctorId: string): TimeSlot[] => {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0-6
  
  // 1. Get Doctor's Schedule for this day
  const docSchedule = MOCK_SCHEDULES[doctorId] || [];
  const shifts = docSchedule.filter(s => s.dayOfWeek === dayOfWeek);

  if (shifts.length === 0) return []; // Not working today

  let slots: TimeSlot[] = [];

  // 2. Generate slots for each shift
  shifts.forEach(shift => {
      let currentTime = shift.startTime;
      while (isTimeBefore(addMinutes(currentTime, shift.slotDuration), shift.endTime) || currentTime === shift.endTime) {
           if (isTimeBefore(currentTime, shift.endTime)) {
               const slotTime = currentTime;
               
               const isBooked = MOCK_APPOINTMENTS.some(apt => 
                 apt.date === dateStr && 
                 apt.doctorId === doctorId && 
                 apt.timeSlot === slotTime && 
                 apt.status !== AppointmentStatus.CANCELLED
               );

               slots.push({
                   time: slotTime,
                   available: !isBooked
               });
           }
           currentTime = addMinutes(currentTime, shift.slotDuration);
      }
  });

  return slots.sort((a,b) => a.time.localeCompare(b.time));
};