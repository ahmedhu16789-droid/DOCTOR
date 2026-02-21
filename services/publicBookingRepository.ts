import { Appointment, AppointmentStatus, Department, Patient, PaymentStatus, TimeSlot, User, UserRole } from '../types';
import { MOCK_USERS } from '../constants';
import { generateTimeSlots, MOCK_PATIENTS } from './mockData';
import { createAppointmentViaApi, createPatientViaApi, getAvailableSlotsBulkFromApi, getAvailableSlotsFromApi, getDoctorsFromApi, lookupPatientsByPhoneFromApi } from './api';

export type PublicBookingMode = 'backend' | 'demo';


const toBackendId = (value: string): string => {
  const numeric = value.replace(/\D/g, '');
  return numeric || value;
};

export interface PublicBookingRepository {
  getDoctors: (params: { branchId: string; specialty: Department }) => Promise<User[]>;
  getSlots: (params: { doctorId: string; branchId: string; date: string }) => Promise<TimeSlot[]>;
  getSlotsBulk?: (params: { doctorIds: string[]; branchId: string; date: string }) => Promise<Record<string, TimeSlot[]>>;
  lookupPatientsByPhone: (phone: string) => Promise<Patient[]>;
  createAppointment: (payload: {
    patient: Patient;
    doctor: User;
    branchId: string;
    date: string;
    timeSlot: string;
  }) => Promise<void>;
}

const demoRepository: PublicBookingRepository = {
  getDoctors: async ({ branchId, specialty }) => MOCK_USERS.filter(
    (user) => user.role === UserRole.DOCTOR && user.specialty === specialty && user.assignedBranches.includes(branchId),
  ),
  getSlots: async ({ doctorId, date }) => generateTimeSlots(date, doctorId),
  getSlotsBulk: async ({ doctorIds, date }) => Object.fromEntries(doctorIds.map((doctorId) => [doctorId, generateTimeSlots(date, doctorId)])),
  lookupPatientsByPhone: async (phone) => MOCK_PATIENTS.filter((patient) => patient.phone === phone),
  createAppointment: async () => undefined,
};

const backendRepository: PublicBookingRepository = {
  getDoctors: async ({ branchId, specialty }) => getDoctorsFromApi({ branchId: toBackendId(branchId), specialty }),
  getSlots: async ({ doctorId, branchId, date }) => getAvailableSlotsFromApi({
    doctorId: toBackendId(doctorId),
    branchId: toBackendId(branchId),
    date,
  }),

  getSlotsBulk: async ({ doctorIds, branchId, date }) => {
    const normalizedDoctorIds = doctorIds.map((doctorId) => toBackendId(doctorId));
    const payload = await getAvailableSlotsBulkFromApi({
      doctorIds: normalizedDoctorIds,
      branchId: toBackendId(branchId),
      date,
    });

    return doctorIds.reduce<Record<string, TimeSlot[]>>((acc, doctorId, index) => {
      const normalizedDoctorId = normalizedDoctorIds[index];
      acc[doctorId] = payload[normalizedDoctorId] ?? [];
      return acc;
    }, {});
  },
  lookupPatientsByPhone: async (phone) => lookupPatientsByPhoneFromApi(phone),
  createAppointment: async ({ patient, doctor, branchId, date, timeSlot }) => {
    let effectivePatient = patient;

    if (Number.isNaN(Number(patient.id))) {
      effectivePatient = await createPatientViaApi({
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        medicalHistorySummary: patient.medicalHistorySummary,
      });
    }

    await createAppointmentViaApi({
      patientId: effectivePatient.id,
      patientName: effectivePatient.name,
      doctorId: toBackendId(doctor.id),
      doctorName: doctor.name,
      branchId: toBackendId(branchId),
      date,
      timeSlot,
      department: doctor.specialty ?? Department.INTERNAL_MEDICINE,
      status: AppointmentStatus.SCHEDULED,
      type: 'Consultation',
      billing: {
        items: [],
        subtotal: doctor.consultationFee ?? 0,
        discount: 0,
        total: doctor.consultationFee ?? 0,
        paidAmount: 0,
        status: PaymentStatus.UNPAID,
        transactions: [],
      },
      createdAt: new Date().toISOString(),
    } as Appointment);
  },
};

export const getPublicBookingRepository = (mode: PublicBookingMode): PublicBookingRepository => {
  return mode === 'backend' ? backendRepository : demoRepository;
};
