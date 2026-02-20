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

export type LandingData = {
  seo: SeoData;
  brand: { name: string; logoText: string };
  header: { ctaLabel: string; ctaHref: string; skipToContentLabel: string; navLinks: NavLink[] };
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
  footer: {
    description: string;
    socialLinks: Array<{ label: string; href: string; short: string }>;
    columns: Array<{ title: string; links: NavLink[] }>;
    copyright: string;
    credits: string;
  };
};
