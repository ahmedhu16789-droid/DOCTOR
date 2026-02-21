"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createPublicAppointment, getAvailableSlots, type BookingClinicContext } from "@/lib/publicBookingApi";
import type { AppointmentPageData } from "@/types/landing";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const BOOKING_DRAFT_KEY = "doctor_booking_draft";
const BOOKING_TICKET_KEY = "doctor_booking_ticket";

type BookingTicket = {
  bookingId: string;
  branchName: string;
  specialty: string;
  doctorName: string;
  date: string;
  slot: string;
  fullName: string;
  phone: string;
  age: string;
  gender: string;
  confirmedAt: string;
};

export function BookingFlow({ data, clinicContext }: { data: AppointmentPageData; clinicContext: BookingClinicContext | null }) {
  const specialties = useMemo(() => {
    const apiSpecialties = Array.from(new Set((clinicContext?.doctors ?? []).map((doctor) => doctor.specialty).filter(Boolean)));
    return apiSpecialties.length > 0 ? apiSpecialties : data.booking.specialtyOptions;
  }, [clinicContext?.doctors, data.booking.specialtyOptions]);

  const [specialty, setSpecialty] = useState(specialties[0] ?? "");
  const [doctorId, setDoctorId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>(clinicContext?.branches[0] ? String(clinicContext.branches[0].id) : "");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [slot, setSlot] = useState("");
  const [gender, setGender] = useState(data.patientForm.genderOptions[0] ?? "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmedTicket, setConfirmedTicket] = useState<BookingTicket | null>(null);

  const doctors = useMemo(() => {
    if (!clinicContext?.doctors?.length) {
      return data.booking.doctorOptions.map((name, index) => ({ id: String(index + 1), name, specialty, branchIds: [] as number[] }));
    }

    return clinicContext.doctors
      .filter((doctor) => doctor.specialty === specialty)
      .filter((doctor) => !branchId || doctor.branchIds.includes(Number(branchId)))
      .map((doctor) => ({ id: String(doctor.id), name: doctor.name, specialty: doctor.specialty, branchIds: doctor.branchIds }));
  }, [branchId, clinicContext?.doctors, data.booking.doctorOptions, specialty]);

  useEffect(() => {
    setDoctorId(doctors[0]?.id ?? "");
    setSlot("");
  }, [doctors]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedDraft = window.sessionStorage.getItem(BOOKING_DRAFT_KEY);
    const savedTicket = window.sessionStorage.getItem(BOOKING_TICKET_KEY);

    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as Partial<BookingTicket> & { doctorId?: string; branchId?: string };
        setSpecialty(draft.specialty ?? specialty);
        setDoctorId(draft.doctorId ?? "");
        setBranchId(draft.branchId ?? branchId);
        setSelectedDate(draft.date ?? selectedDate);
        setSlot(draft.slot ?? "");
        setFullName(draft.fullName ?? "");
        setPhone(draft.phone ?? "");
        setAge(draft.age ?? "");
        setGender(draft.gender ?? gender);
      } catch {
        window.sessionStorage.removeItem(BOOKING_DRAFT_KEY);
      }
    }

    if (savedTicket) {
      try {
        setConfirmedTicket(JSON.parse(savedTicket) as BookingTicket);
      } catch {
        window.sessionStorage.removeItem(BOOKING_TICKET_KEY);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const draft = {
      specialty,
      doctorId,
      branchId,
      date: selectedDate,
      slot,
      fullName,
      phone,
      age,
      gender,
    };

    window.sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
  }, [age, branchId, doctorId, fullName, gender, phone, selectedDate, slot, specialty]);

  useEffect(() => {
    if (!clinicContext || !doctorId || !branchId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }

    let active = true;
    setIsLoadingSlots(true);

    getAvailableSlots({
      clinicId: clinicContext.clinic.id,
      doctorId: Number(doctorId),
      branchId: Number(branchId),
      date: selectedDate,
    })
      .then((slots) => {
        if (!active) return;
        setAvailableSlots(slots);
        const firstAvailable = slots.find((item) => item.available)?.time ?? "";
        setSlot(firstAvailable);
      })
      .catch(() => {
        if (!active) return;
        setAvailableSlots([]);
      })
      .finally(() => {
        if (active) setIsLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [branchId, clinicContext, doctorId, selectedDate]);

  const handleSubmit = async () => {
    if (!clinicContext || !doctorId || !branchId || !selectedDate || !slot || !fullName || !phone) {
      setFeedback({ type: "error", text: "Please complete all required booking fields." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await createPublicAppointment({
        clinicId: clinicContext.clinic.id,
        doctorId: Number(doctorId),
        branchId: Number(branchId),
        date: selectedDate,
        timeSlot: slot,
        patient: {
          name: fullName,
          phone,
          age: age ? Number(age) : undefined,
          gender,
        },
      });

      const selectedBranchName = clinicContext.branches.find((branch) => String(branch.id) === branchId)?.name ?? "-";
      const selectedDoctorName = doctors.find((doctor) => doctor.id === doctorId)?.name ?? "-";

      const ticket: BookingTicket = {
        bookingId: `BK-${Date.now().toString().slice(-8)}`,
        branchName: selectedBranchName,
        specialty,
        doctorName: selectedDoctorName,
        date: selectedDate,
        slot,
        fullName,
        phone,
        age,
        gender,
        confirmedAt: new Date().toISOString(),
      };

      setConfirmedTicket(ticket);
      window.sessionStorage.setItem(BOOKING_TICKET_KEY, JSON.stringify(ticket));

      setFeedback({ type: "success", text: "تم تأكيد الحجز بنجاح. سيقوم فريق العيادة بالتواصل معك قريبًا." });
    } catch {
      setFeedback({ type: "error", text: "تعذر إتمام الحجز الآن. حاول مرة أخرى بعد قليل." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTicket = () => {
    if (!confirmedTicket || typeof window === "undefined") return;

    const lines = [
      "Appointment Ticket",
      `Booking ID: ${confirmedTicket.bookingId}`,
      `Patient: ${confirmedTicket.fullName}`,
      `Phone: ${confirmedTicket.phone}`,
      `Doctor: ${confirmedTicket.doctorName}`,
      `Specialty: ${confirmedTicket.specialty}`,
      `Branch: ${confirmedTicket.branchName}`,
      `Date: ${confirmedTicket.date}`,
      `Time: ${confirmedTicket.slot}`,
      `Confirmed At: ${new Date(confirmedTicket.confirmedAt).toLocaleString()}`,
    ];

    const stream = lines
      .map((line, index) => `BT /F1 12 Tf 50 ${780 - index * 24} Td (${line.replace(/[()\\]/g, "")}) Tj ET`)
      .join("\n");

    const pdfObjects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
      `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
      "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    pdfObjects.forEach((obj) => {
      offsets.push(pdf.length);
      pdf += `${obj}\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${pdfObjects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer << /Root 1 0 R /Size ${pdfObjects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${confirmedTicket.bookingId}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-col gap-8 p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {clinicContext?.branches?.length ? (
            <Field label="الفرع">
              <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {clinicContext.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label={data.booking.specialtyLabel}>
            <Select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
              {specialties.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label={data.booking.doctorLabel}>
            <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
              {doctors.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <hr className="border-slate-100" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-900">{data.booking.calendarTitle}</h3>
            <Input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-900">{data.booking.timeSlotsTitle}</h3>
            {isLoadingSlots ? <p className="text-sm text-slate-500">Loading available slots...</p> : null}
            <div className="grid grid-cols-3 gap-3">
              {availableSlots.map((time) => {
                const isDisabled = !time.available;
                const isActive = slot === time.time && time.available;
                return (
                  <button
                    key={time.time}
                    disabled={isDisabled}
                    onClick={() => setSlot(time.time)}
                    className={`rounded-lg border px-3 py-2 text-sm ${isActive ? "border-blue-600 bg-blue-600 font-bold text-white" : "border-slate-200 text-slate-600"} ${isDisabled ? "cursor-not-allowed text-slate-400 line-through" : "hover:border-blue-600 hover:text-blue-600"}`}
                  >
                    {time.time}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        <div className="flex flex-col gap-4">
          <h3 className="mb-2 text-base font-bold text-slate-900">{data.patientForm.title}</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label={data.patientForm.fullNameLabel}>
                <Input placeholder={data.patientForm.fullNamePlaceholder} value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </Field>
            </div>
            <Field label={data.patientForm.phoneLabel}>
              <Input type="tel" placeholder={data.patientForm.phonePlaceholder} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={data.patientForm.ageLabel}>
                <Input placeholder={data.patientForm.agePlaceholder} type="number" value={age} onChange={(event) => setAge(event.target.value)} />
              </Field>
              <Field label={data.patientForm.genderLabel}>
                <div className="flex h-[46px] items-center gap-4">
                  {data.patientForm.genderOptions.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name="gender" checked={gender === option} onChange={() => setGender(option)} className="h-4 w-4" />
                      <span className="text-sm text-slate-700">{option}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </div>
          {feedback ? <p className={`text-sm ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>{feedback.text}</p> : null}

          {confirmedTicket ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-700">🎫 Ticket #{confirmedTicket.bookingId}</p>
              <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p><span className="font-semibold">Patient:</span> {confirmedTicket.fullName}</p>
                <p><span className="font-semibold">Phone:</span> {confirmedTicket.phone}</p>
                <p><span className="font-semibold">Doctor:</span> {confirmedTicket.doctorName}</p>
                <p><span className="font-semibold">Specialty:</span> {confirmedTicket.specialty}</p>
                <p><span className="font-semibold">Branch:</span> {confirmedTicket.branchName}</p>
                <p><span className="font-semibold">Schedule:</span> {confirmedTicket.date} - {confirmedTicket.slot}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleDownloadTicket}>Download PDF</Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 p-6 md:flex-row">
        <p className="flex items-center gap-1 text-xs text-slate-500">🔒 {data.patientForm.privacyNote}</p>
        <Button className="w-full px-8 py-3 md:w-auto" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "جاري الحجز..." : data.cta.confirmLabel}</Button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}
