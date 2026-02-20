import type { AppointmentPageData } from "@/types/landing";
import { Stepper } from "@/components/appointment/Stepper";
import { BookingFlow } from "@/components/appointment/BookingFlow.client";

export function BookingCard({ data }: { data: AppointmentPageData }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 p-6">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">{data.booking.pageTitle}</h1>
        <p className="text-sm text-slate-500">{data.booking.subtitle}</p>
        <Stepper steps={data.booking.steps} />
      </div>
      <BookingFlow data={data} />
    </div>
  );
}
