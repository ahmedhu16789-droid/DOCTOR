import { Appointment, AppointmentStatus, Department, Patient, TimeSlot, Medication, ServiceItem, WeeklyShift, Employee, UserRole } from '../types';
import { MOCK_APPOINTMENTS_SEED, MOCK_PATIENTS_SEED, MOCK_SCHEDULES } from './mock/seed';

export { MOCK_SCHEDULES };

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

export const MOCK_PATIENTS: Patient[] = MOCK_PATIENTS_SEED;

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

export const MOCK_APPOINTMENTS: Appointment[] = MOCK_APPOINTMENTS_SEED;

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
  const docSchedule: WeeklyShift[] = MOCK_SCHEDULES[doctorId] || [];
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
