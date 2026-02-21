import { apiFetch } from '../services/core/httpClient';

const TOKEN_KEY = 'patient-portal:token';

export interface PatientPortalAppointment {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
  doctor: { id: string; name: string; specialty?: string };
  branch: { id: string; name: string; location?: string };
  canReschedule: boolean;
  canCancel: boolean;
}

export interface PatientPortalVisit {
  id: string;
  status: string;
  diagnosis?: string;
  plan?: string;
  nextVisitDate?: string;
  appointment: { id: string; date: string; timeSlot: string; doctorName?: string };
  prescriptions: Array<{ id: string; medicationName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>;
}

const patientFetch = async <T>(endpoint: string, init?: RequestInit) => {
  const token = localStorage.getItem(TOKEN_KEY);
  return apiFetch<T>(endpoint, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

export const patientPortalLogin = async (phone: string, password: string) => {
  const response = await apiFetch<{ token: string; patient: { id: string; name: string } }>('/v1/patient-portal/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });

  localStorage.setItem(TOKEN_KEY, response.token);
  return response.patient;
};

export const patientPortalMe = () => patientFetch<{ data: { id: string; name: string; phone: string } }>('/v1/patient-portal/auth/me');

export const patientPortalUpcomingAppointments = () => patientFetch<{ data: PatientPortalAppointment[] }>('/v1/patient-portal/appointments/upcoming');

export const patientPortalVisitHistory = () => patientFetch<{ data: PatientPortalVisit[] }>('/v1/patient-portal/visits');

export const patientPortalRescheduleAppointment = (appointmentId: string, date: string, timeSlot: string) => patientFetch(`/v1/patient-portal/appointments/${appointmentId}/reschedule`, {
  method: 'POST',
  body: JSON.stringify({ date, timeSlot }),
});

export const patientPortalCancelAppointment = (appointmentId: string) => patientFetch(`/v1/patient-portal/appointments/${appointmentId}/cancel`, {
  method: 'POST',
});

export const patientPortalDownloadPrescriptionUrl = (prescriptionId: string) => `${(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '')}/v1/patient-portal/prescriptions/${prescriptionId}/download`;
