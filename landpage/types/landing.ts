export type Locale = "en" | "ar";

export type LocalizedValue = {
  en: string;
  ar: string;
};

export type LandingDataRaw = DeepLocalized<LandingData>;

type DeepLocalized<T> = T extends string
  ? string | LocalizedValue
  : T extends Array<infer U>
    ? Array<DeepLocalized<U>>
    : T extends object
      ? { [K in keyof T]: DeepLocalized<T[K]> }
      : T;

export type NavLink = {
  label: string;
  href: string;
};

export type SeoData = {
  siteName: string;
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  openGraphImage: string;
  twitterCard: "summary" | "summary_large_image";
  robots: string;
};

export type Cta = {
  label: string;
  href: string;
};

export type Specialty = {
  id: string;
  title: string;
  description: string;
  iconName: "orthopedics" | "dentistry" | "ophthalmology";
  href: string;
};

export type Doctor = {
  name: string;
  specialty: string;
  experienceLabel: string;
  imageSrc: string;
  imageAlt: string;
};

export type Testimonial = {
  quote: string;
  patientName: string;
  patientRole: string;
  avatarSrc: string;
  avatarAlt: string;
};

export type BookingField = {
  name: string;
  label: string;
  type: "text" | "tel" | "date" | "select";
  placeholder: string;
  required?: boolean;
  options?: string[];
};

export type HeaderData = {
  ctaLabel: string;
  ctaHref: string;
  skipToContentLabel: string;
  navLinks: NavLink[];
};

export type FooterData = {
  description: string;
  socialLinks: Array<{ label: string; href: string; short: string }>;
  columns: Array<{ title: string; links: NavLink[] }>;
  copyright: string;
  credits: string;
};

export type AppointmentPageData = {
  seo: {
    title: string;
    description: string;
    canonical: string;
    keywords: string[];
    openGraphImage: string;
    twitterCard: "summary" | "summary_large_image";
  };
  nav: {
    brand: { logoText: string; href: string };
    links: NavLink[];
    ctaLabel: string;
    ctaHref: string;
    skipToContentLabel: string;
  };
  clinicInfo: {
    title: string;
    description: string;
    noticeTitle: string;
    noticeText: string;
    locationLabel: string;
    location: string;
    phoneLabel: string;
    phone: string;
    hoursLabel: string;
    hours: string;
    mapImageSrc: string;
    mapImageAlt: string;
    mapButtonLabel: string;
  };
  booking: {
    pageTitle: string;
    title: string;
    subtitle: string;
    steps: string[];
    specialtyLabel: string;
    doctorLabel: string;
    specialtyOptions: string[];
    doctorOptions: string[];
    calendarTitle: string;
    calendarMonthLabel: string;
    weekDays: string[];
    days: Array<{ day: number; status: "muted" | "selected" | "available" }>;
    timeSlotsTitle: string;
    timeSlots: Array<{ label: string; status: "selected" | "available" | "unavailable" }>;
    legend: {
      selected: string;
      available: string;
      unavailable: string;
    };
  };
  patientForm: {
    title: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    ageLabel: string;
    agePlaceholder: string;
    genderLabel: string;
    genderOptions: string[];
    privacyNote: string;
  };
  cta: {
    confirmLabel: string;
    action: string;
  };
  ui: {
    loadingSlots: string;
    validationRequiredFields: string;
    submitSuccess: string;
    submitError: string;
    branchLabel: string;
    ticketTitle: string;
    ticketPatientLabel: string;
    ticketPhoneLabel: string;
    ticketDoctorLabel: string;
    ticketSpecialtyLabel: string;
    ticketBranchLabel: string;
    ticketScheduleLabel: string;
    printTicketLabel: string;
    submittingLabel: string;
    printNote: string;
    printPageTitle: string;
    printLang: string;
    printDir: "ltr" | "rtl";
    printHeading: string;
    printBookingNumberLabel: string;
    printPatientNameLabel: string;
    printPhoneNumberLabel: string;
    printBranchLabel: string;
    printSpecialtyLabel: string;
    printDoctorLabel: string;
    printVisitScheduleLabel: string;
    printGenderAgeLabel: string;
    printConfirmedAtLabel: string;
  };
  physicians: Array<{
    name: string;
    specialty: string;
    imageSrc: string;
  }>;
};

export type LandingData = {
  seo: SeoData;
  brand: { name: string; logoText: string };
  header: HeaderData;
  hero: {
    badge: string;
    title: string;
    highlight: string;
    description: string;
    primaryCta: Cta;
    secondaryCta: Cta;
    backgroundImage: string;
    backgroundAlt: string;
  };
  stats: Array<{ value: string; label: string }>;
  specialties: {
    eyebrow: string;
    title: string;
    description: string;
    viewAllLabel: string;
    viewAllHref: string;
    learnMoreLabel: string;
    items: Specialty[];
  };
  doctors: {
    eyebrow: string;
    title: string;
    description: string;
    items: Doctor[];
  };
  whyChooseUs: {
    eyebrow: string;
    title: string;
    description: string;
    imageSrc: string;
    imageAlt: string;
    features: Array<{ title: string; description: string }>;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    items: Testimonial[];
  };
  booking: {
    eyebrow: string;
    title: string;
    description: string;
    formTitle: string;
    submitLabel: string;
    contact: { phone: string; address: string; email: string; hours: string };
    fields: BookingField[];
  };
  appointmentPage: AppointmentPageData;
  footer: FooterData;
};
