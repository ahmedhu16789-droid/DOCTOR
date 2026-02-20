"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { AppointmentPageData } from "@/types/landing";
import { useState, type ReactNode } from "react";

export function BookingFlow({ data }: { data: AppointmentPageData }) {
  const [specialty, setSpecialty] = useState(data.booking.specialtyOptions[0] ?? "");
  const [doctor, setDoctor] = useState(data.booking.doctorOptions[0] ?? "");
  const [slot, setSlot] = useState(data.booking.timeSlots.find((item) => item.status === "selected")?.label ?? "");
  const [gender, setGender] = useState(data.patientForm.genderOptions[0] ?? "");

  return (
    <>
      <div className="flex flex-col gap-8 p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label={data.booking.specialtyLabel}>
            <Select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
              {data.booking.specialtyOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label={data.booking.doctorLabel}>
            <Select value={doctor} onChange={(event) => setDoctor(event.target.value)}>
              {data.booking.doctorOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        </div>

        <hr className="border-slate-100" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{data.booking.calendarTitle}</h3>
              <span className="text-sm font-semibold">{data.booking.calendarMonthLabel}</span>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
              {data.booking.weekDays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {data.booking.days.map((day, index) => (
                <button key={`${day.day}-${index}`} className={dayClass(day.status)}>
                  {day.day > 0 ? day.day : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-900">{data.booking.timeSlotsTitle}</h3>
            <div className="grid grid-cols-3 gap-3">
              {data.booking.timeSlots.map((time) => {
                const isDisabled = time.status === "unavailable";
                const isActive = slot === time.label && time.status !== "unavailable";
                return (
                  <button
                    key={time.label}
                    disabled={isDisabled}
                    onClick={() => setSlot(time.label)}
                    className={`rounded-lg border px-3 py-2 text-sm ${isActive ? "border-blue-600 bg-blue-600 font-bold text-white" : "border-slate-200 text-slate-600"} ${isDisabled ? "cursor-not-allowed text-slate-400 line-through" : "hover:border-blue-600 hover:text-blue-600"}`}
                  >
                    {time.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-600" /> {data.booking.legend.selected}
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-slate-300" /> {data.booking.legend.available}
              <span className="ml-2 inline-block h-2 w-2 rounded-full border border-slate-300" /> {data.booking.legend.unavailable}
            </p>
          </div>
        </div>

        <hr className="border-slate-100" />

        <div className="flex flex-col gap-4">
          <h3 className="mb-2 text-base font-bold text-slate-900">{data.patientForm.title}</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label={data.patientForm.fullNameLabel}>
                <Input placeholder={data.patientForm.fullNamePlaceholder} />
              </Field>
            </div>
            <Field label={data.patientForm.phoneLabel}>
              <Input type="tel" placeholder={data.patientForm.phonePlaceholder} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={data.patientForm.ageLabel}>
                <Input placeholder={data.patientForm.agePlaceholder} type="number" />
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
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 p-6 md:flex-row">
        <p className="flex items-center gap-1 text-xs text-slate-500">🔒 {data.patientForm.privacyNote}</p>
        <Button className="w-full px-8 py-3 md:w-auto">{data.cta.confirmLabel}</Button>
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

function dayClass(status: "muted" | "selected" | "available") {
  if (status === "muted") return "aspect-square rounded-lg text-sm text-slate-400";
  if (status === "selected") return "aspect-square rounded-lg bg-blue-600 text-sm font-bold text-white";
  return "aspect-square rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100";
}
