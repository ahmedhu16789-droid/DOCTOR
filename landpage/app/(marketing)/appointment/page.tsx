import type { Metadata } from "next";
import { AppointmentLayout } from "@/components/appointment/AppointmentLayout";
import { BookingCard } from "@/components/appointment/BookingCard";
import { ClinicInfoCard } from "@/components/appointment/ClinicInfoCard";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { getLandingData } from "@/lib/getLandingData";
import { getAppointmentJsonLd } from "@/lib/seoJsonLd";
import { getClinicContext } from "@/lib/publicBookingApi";

const data = getLandingData();
const appointment = data.appointmentPage;

export const metadata: Metadata = {
  title: appointment.seo.title,
  description: appointment.seo.description,
  keywords: appointment.seo.keywords,
  alternates: {
    canonical: appointment.seo.canonical,
  },
  openGraph: {
    title: appointment.seo.title,
    description: appointment.seo.description,
    url: appointment.seo.canonical,
    siteName: data.seo.siteName,
    images: [{ url: appointment.seo.openGraphImage }],
    type: "website",
  },
  twitter: {
    card: appointment.seo.twitterCard,
    title: appointment.seo.title,
    description: appointment.seo.description,
    images: [appointment.seo.openGraphImage],
  },
};

export default async function AppointmentPage() {
  const jsonLd = getAppointmentJsonLd(data);
  const clinicContext = await getClinicContext();

  return (
    <>
      <Header
        brand={appointment.nav.brand}
        header={{
          ctaLabel: appointment.nav.ctaLabel,
          ctaHref: appointment.nav.ctaHref,
          navLinks: appointment.nav.links,
          skipToContentLabel: appointment.nav.skipToContentLabel,
        }}
      />
      <main id="main-content" className="min-h-screen bg-slate-50">
        <AppointmentLayout
          sidebar={<ClinicInfoCard clinicInfo={appointment.clinicInfo} clinicContext={clinicContext} />}
          content={<BookingCard data={appointment} clinicContext={clinicContext} />}
        />
      </main>
      <Footer brand={{ name: data.brand.name, logoText: appointment.nav.brand.logoText }} footer={data.footer} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
