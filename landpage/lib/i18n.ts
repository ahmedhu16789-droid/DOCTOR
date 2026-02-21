export type LandingLocale = "ar" | "en";

export type LandingTextKey =
  | "booking.validation.requiredFields"
  | "booking.feedback.success"
  | "booking.feedback.error"
  | "booking.loadingSlots"
  | "booking.ticket.summaryTitle"
  | "booking.ticket.patientLabel"
  | "booking.ticket.phoneLabel"
  | "booking.ticket.doctorLabel"
  | "booking.ticket.specialtyLabel"
  | "booking.ticket.branchLabel"
  | "booking.ticket.scheduleLabel"
  | "booking.ticket.printButton"
  | "booking.submit.loading"
  | "booking.print.title"
  | "booking.print.bookingNumber"
  | "booking.print.fullName"
  | "booking.print.phone"
  | "booking.print.branch"
  | "booking.print.specialty"
  | "booking.print.doctor"
  | "booking.print.visitSchedule"
  | "booking.print.genderAge"
  | "booking.print.confirmedAt"
  | "booking.print.note";

const translations: Record<LandingLocale, Record<LandingTextKey, string>> = {
  ar: {
    "booking.validation.requiredFields": "يرجى استكمال جميع الحقول المطلوبة للحجز.",
    "booking.feedback.success": "تم تأكيد الحجز بنجاح. سيقوم فريق العيادة بالتواصل معك قريبًا.",
    "booking.feedback.error": "تعذر إتمام الحجز الآن. حاول مرة أخرى بعد قليل.",
    "booking.loadingSlots": "جاري تحميل المواعيد المتاحة...",
    "booking.ticket.summaryTitle": "🎫 التذكرة #{bookingId}",
    "booking.ticket.patientLabel": "المريض:",
    "booking.ticket.phoneLabel": "الهاتف:",
    "booking.ticket.doctorLabel": "الطبيب:",
    "booking.ticket.specialtyLabel": "التخصص:",
    "booking.ticket.branchLabel": "الفرع:",
    "booking.ticket.scheduleLabel": "الموعد:",
    "booking.ticket.printButton": "طباعة / تنزيل PDF",
    "booking.submit.loading": "جاري الحجز...",
    "booking.print.title": "🎫 تذكرة الحجز",
    "booking.print.bookingNumber": "رقم الحجز",
    "booking.print.fullName": "اسم المريض",
    "booking.print.phone": "رقم الهاتف",
    "booking.print.branch": "الفرع",
    "booking.print.specialty": "التخصص",
    "booking.print.doctor": "الطبيب",
    "booking.print.visitSchedule": "موعد الزيارة",
    "booking.print.genderAge": "النوع / السن",
    "booking.print.confirmedAt": "تاريخ التأكيد",
    "booking.print.note": "يرجى الاحتفاظ بهذه التذكرة وإبرازها عند الحضور. يمكنك اختيار \"Save as PDF\" من نافذة الطباعة لتنزيلها PDF.",
  },
  en: {
    "booking.validation.requiredFields": "Please complete all required booking fields.",
    "booking.feedback.success": "Booking has been confirmed successfully. Our clinic team will contact you shortly.",
    "booking.feedback.error": "We couldn't complete the booking right now. Please try again shortly.",
    "booking.loadingSlots": "Loading available slots...",
    "booking.ticket.summaryTitle": "🎫 Ticket #{bookingId}",
    "booking.ticket.patientLabel": "Patient:",
    "booking.ticket.phoneLabel": "Phone:",
    "booking.ticket.doctorLabel": "Doctor:",
    "booking.ticket.specialtyLabel": "Specialty:",
    "booking.ticket.branchLabel": "Branch:",
    "booking.ticket.scheduleLabel": "Schedule:",
    "booking.ticket.printButton": "Print / Download PDF",
    "booking.submit.loading": "Booking...",
    "booking.print.title": "🎫 Booking Ticket",
    "booking.print.bookingNumber": "Booking Number",
    "booking.print.fullName": "Patient Name",
    "booking.print.phone": "Phone Number",
    "booking.print.branch": "Branch",
    "booking.print.specialty": "Specialty",
    "booking.print.doctor": "Doctor",
    "booking.print.visitSchedule": "Visit Schedule",
    "booking.print.genderAge": "Gender / Age",
    "booking.print.confirmedAt": "Confirmed At",
    "booking.print.note": "Please keep this ticket and present it upon arrival. You can choose \"Save as PDF\" from the print window to download it as PDF.",
  },
};

const localeDirection: Record<LandingLocale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function resolveLandingLocale(language?: string | null): LandingLocale {
  return language?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function getLandingDir(locale: LandingLocale): "rtl" | "ltr" {
  return localeDirection[locale];
}

export function translateLanding(
  locale: LandingLocale,
  key: LandingTextKey,
  variables?: Record<string, string>,
): string {
  const template = translations[locale][key];

  if (!variables) return template;

  return Object.entries(variables).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, value),
    template,
  );
}
