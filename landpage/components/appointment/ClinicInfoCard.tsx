import Image from "next/image";
import type { AppointmentPageData } from "@/types/landing";
import type { BookingClinicContext } from "@/lib/publicBookingApi";

export function ClinicInfoCard({ clinicInfo, clinicContext }: { clinicInfo: AppointmentPageData["clinicInfo"]; clinicContext: BookingClinicContext | null }) {
  const location = clinicContext?.clinic.address || clinicInfo.location;
  const phone = clinicContext?.clinic.phone || clinicInfo.phone;
  const hours = clinicContext?.clinic.hours || clinicInfo.hours;

  return (
    <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">{clinicInfo.title}</h2>
        <p className="text-sm text-slate-500">{clinicInfo.description}</p>
      </div>
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <span className="text-blue-600">ⓘ</span>
        <div>
          <h3 className="mb-1 text-sm font-bold text-blue-600">{clinicInfo.noticeTitle}</h3>
          <p className="text-xs leading-relaxed text-slate-600">{clinicInfo.noticeText}</p>
        </div>
      </div>
      <div className="space-y-4">
        <InfoItem label={clinicInfo.locationLabel} value={location} icon="📍" />
        <InfoItem label={clinicInfo.phoneLabel} value={phone} icon="📞" />
        <InfoItem label={clinicInfo.hoursLabel} value={hours} icon="🕒" />
      </div>
      <div className="mt-6 border-t border-slate-100 pt-6">
        <div className="relative h-32 overflow-hidden rounded-lg bg-slate-200">
          <Image src={clinicInfo.mapImageSrc} alt={clinicInfo.mapImageAlt} fill className="object-cover opacity-80" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <button className="rounded bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900">{clinicInfo.mapButtonLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-slate-100 p-2 text-slate-600">{icon}</div>
      <div>
        <h4 className="text-sm font-bold text-slate-900">{label}</h4>
        <p className="text-sm text-slate-500">{value}</p>
      </div>
    </div>
  );
}
