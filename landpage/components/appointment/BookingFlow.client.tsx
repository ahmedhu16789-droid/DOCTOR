"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createPublicAppointment, getAvailableSlots, type BookingClinicContext } from "@/lib/publicBookingApi";
import type { AppointmentPageData } from "@/types/landing";
import { useEffect, useMemo, useState, type ReactNode } from "react";

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

      setFeedback({ type: "success", text: "تم تأكيد الحجز بنجاح. سيقوم فريق العيادة بالتواصل معك قريبًا." });
    } catch {
      setFeedback({ type: "error", text: "تعذر إتمام الحجز الآن. حاول مرة أخرى بعد قليل." });
    } finally {
      setIsSubmitting(false);
    }
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
