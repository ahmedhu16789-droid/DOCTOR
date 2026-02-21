export type BookingClinicContext = {
  clinic: {
    id: string;
    name: string;
    phone: string;
    hours: string;
    address: string;
  };
  branches: Array<{
    id: number;
    name: string;
  }>;
  doctors: Array<{
    id: number;
    name: string;
    specialty: string;
    branchIds: number[];
  }>;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const PUBLIC_CLINIC_ID = process.env.NEXT_PUBLIC_PUBLIC_CLINIC_ID ?? "00000000-0000-0000-0000-000000000001";

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Booking API failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function getClinicContext(): Promise<BookingClinicContext | null> {
  try {
    const payload = await backendFetch<{ data: BookingClinicContext }>(`/api/v1/public/booking/clinic-context?clinicPublicId=${PUBLIC_CLINIC_ID}`);
    return payload.data;
  } catch {
    return null;
  }
}

export async function getAvailableSlots(params: { clinicPublicId: string; doctorId: number; branchId: number; date: string }) {
  const query = new URLSearchParams({
    clinicPublicId: params.clinicPublicId,
    doctorId: String(params.doctorId),
    branchId: String(params.branchId),
    date: params.date,
  });

  const payload = await backendFetch<{ data: Array<{ time: string; available: boolean }> }>(`/api/v1/public/booking/available-slots?${query.toString()}`);
  return payload.data;
}

export async function createPublicAppointment(payload: {
  clinicPublicId: string;
  doctorId: number;
  branchId: number;
  date: string;
  timeSlot: string;
  patient: {
    name: string;
    phone: string;
    age?: number;
    gender?: string;
  };
}) {
  return backendFetch<{ message: string; data: { appointmentId: number } }>("/api/v1/public/booking", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
