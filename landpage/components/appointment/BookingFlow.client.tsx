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

type BookingDraft = {
  specialty: string;
  doctorId: string;
  branchId: string;
  date: string;
  slot: string;
  fullName: string;
  phone: string;
  age: string;
  gender: string;
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
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);

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
    if (doctorId && doctors.some((doctor) => doctor.id === doctorId)) {
      return;
    }

    setDoctorId(doctors[0]?.id ?? "");
    setSlot("");
  }, [doctorId, doctors]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedDraft = window.sessionStorage.getItem(BOOKING_DRAFT_KEY);
    const savedTicket = window.sessionStorage.getItem(BOOKING_TICKET_KEY);

    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as Partial<BookingDraft>;
        setSpecialty(draft.specialty ?? specialties[0] ?? "");
        setDoctorId(draft.doctorId ?? "");
        setBranchId(draft.branchId ?? (clinicContext?.branches[0] ? String(clinicContext.branches[0].id) : ""));
        setSelectedDate(draft.date ?? new Date().toISOString().slice(0, 10));
        setSlot(draft.slot ?? "");
        setFullName(draft.fullName ?? "");
        setPhone(draft.phone ?? "");
        setAge(draft.age ?? "");
        setGender(draft.gender ?? data.patientForm.genderOptions[0] ?? "");
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

    setHasHydratedStorage(true);
  }, [clinicContext?.branches, data.patientForm.genderOptions, specialties]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedStorage) return;

    const draft: BookingDraft = {
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
  }, [age, branchId, doctorId, fullName, gender, hasHydratedStorage, phone, selectedDate, slot, specialty]);

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
        const hasCurrentSlot = slots.some((item) => item.time === slot && item.available);
        if (!hasCurrentSlot) {
          const firstAvailable = slots.find((item) => item.available)?.time ?? "";
          setSlot(firstAvailable);
        }
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
  }, [branchId, clinicContext, doctorId, selectedDate, slot]);

  const handleSubmit = async () => {
    if (!clinicContext || !doctorId || !branchId || !selectedDate || !slot || !fullName || !phone) {
      setFeedback({ type: "error", text: data.ui.validationRequiredFields });
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
      setFeedback({ type: "success", text: data.ui.submitSuccess });
    } catch {
      setFeedback({ type: "error", text: data.ui.submitError });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintTicket = () => {
    if (!confirmedTicket || typeof window === "undefined") return;

    const printableDate = new Date(confirmedTicket.confirmedAt).toLocaleString(data.ui.printLang === "ar" ? "ar-EG" : "en-US");
    const ticketWindow = window.open("", "_blank", "width=900,height=700");
    if (!ticketWindow) return;

    ticketWindow.document.write(`
      <!doctype html>
      <html lang="${data.ui.printLang}" dir="${data.ui.printDir}">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${data.ui.printPageTitle} ${confirmedTicket.bookingId}</title>
          <style>
            body { font-family: "Tahoma", "Arial", sans-serif; background: #f8fafc; padding: 24px; color: #0f172a; }
            .ticket { max-width: 760px; margin: 0 auto; background: #fff; border: 2px dashed #0ea5e9; border-radius: 18px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: #fff; padding: 22px; }
            .header h1 { margin: 0 0 6px; font-size: 24px; }
            .header p { margin: 0; opacity: 0.95; }
            .body { padding: 22px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; }
            .item { padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
            .label { display: block; color: #475569; font-size: 12px; margin-bottom: 4px; }
            .value { font-weight: 700; font-size: 15px; }
            .note { margin-top: 16px; padding: 12px; border-radius: 10px; background: #ecfeff; border: 1px solid #a5f3fc; font-size: 13px; }
            @media print {
              body { background: #fff; padding: 0; }
              .ticket { border-style: solid; border-color: #0f172a; border-radius: 0; max-width: none; }
            }
          </style>
        </head>
        <body>
          <article class="ticket">
            <header class="header">
              <h1>🎫 ${data.ui.printHeading}</h1>
              <p>${data.ui.printBookingNumberLabel} ${confirmedTicket.bookingId}</p>
            </header>
            <section class="body">
              <div class="grid">
                <div class="item"><span class="label">${data.ui.printPatientNameLabel}</span><span class="value">${confirmedTicket.fullName}</span></div>
                <div class="item"><span class="label">${data.ui.printPhoneNumberLabel}</span><span class="value">${confirmedTicket.phone}</span></div>
                <div class="item"><span class="label">${data.ui.printBranchLabel}</span><span class="value">${confirmedTicket.branchName}</span></div>
                <div class="item"><span class="label">${data.ui.printSpecialtyLabel}</span><span class="value">${confirmedTicket.specialty}</span></div>
                <div class="item"><span class="label">${data.ui.printDoctorLabel}</span><span class="value">${confirmedTicket.doctorName}</span></div>
                <div class="item"><span class="label">${data.ui.printVisitScheduleLabel}</span><span class="value">${confirmedTicket.date} - ${confirmedTicket.slot}</span></div>
                <div class="item"><span class="label">${data.ui.printGenderAgeLabel}</span><span class="value">${confirmedTicket.gender || "-"} / ${confirmedTicket.age || "-"}</span></div>
                <div class="item"><span class="label">${data.ui.printConfirmedAtLabel}</span><span class="value">${printableDate}</span></div>
              </div>
              <p class="note">${data.ui.printNote}</p>
            </section>
          </article>
        </body>
      </html>
    `);

    ticketWindow.document.close();
    ticketWindow.focus();
    ticketWindow.print();
  };

  return (
    <>
      <div className="flex flex-col gap-8 p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {clinicContext?.branches?.length ? (
            <Field label={data.ui.branchLabel}>
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
            {isLoadingSlots ? <p className="text-sm text-slate-500">{data.ui.loadingSlots}</p> : null}
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
              <p className="mb-3 text-sm font-semibold text-emerald-700">🎫 {data.ui.ticketTitle}{confirmedTicket.bookingId}</p>
              <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p><span className="font-semibold">{data.ui.ticketPatientLabel}</span> {confirmedTicket.fullName}</p>
                <p><span className="font-semibold">{data.ui.ticketPhoneLabel}</span> {confirmedTicket.phone}</p>
                <p><span className="font-semibold">{data.ui.ticketDoctorLabel}</span> {confirmedTicket.doctorName}</p>
                <p><span className="font-semibold">{data.ui.ticketSpecialtyLabel}</span> {confirmedTicket.specialty}</p>
                <p><span className="font-semibold">{data.ui.ticketBranchLabel}</span> {confirmedTicket.branchName}</p>
                <p><span className="font-semibold">{data.ui.ticketScheduleLabel}</span> {confirmedTicket.date} - {confirmedTicket.slot}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handlePrintTicket}> {data.ui.printTicketLabel} </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 p-6 md:flex-row">
        <p className="flex items-center gap-1 text-xs text-slate-500">🔒 {data.patientForm.privacyNote}</p>
        <Button className="w-full px-8 py-3 md:w-auto" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? data.ui.submittingLabel : data.cta.confirmLabel}</Button>
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
