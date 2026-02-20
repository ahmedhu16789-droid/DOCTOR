import type { Metadata } from "next";
import { Booking } from "@/components/landing/Booking";
import { Doctors } from "@/components/landing/Doctors";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Specialties } from "@/components/landing/Specialties";
import { Stats } from "@/components/landing/Stats";
import { Testimonials } from "@/components/landing/Testimonials";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { getLandingData } from "@/lib/getLandingData";
import { getLandingJsonLd } from "@/lib/seoJsonLd";

const data = getLandingData();

export const metadata: Metadata = {
  title: data.seo.title,
  description: data.seo.description,
  keywords: data.seo.keywords,
  alternates: {
    canonical: data.seo.canonical,
  },
  openGraph: {
    title: data.seo.title,
    description: data.seo.description,
    url: data.seo.canonical,
    siteName: data.seo.siteName,
    images: [{ url: data.seo.openGraphImage }],
    type: "website",
  },
  twitter: {
    card: data.seo.twitterCard,
    title: data.seo.title,
    description: data.seo.description,
    images: [data.seo.openGraphImage],
  },
  robots: data.seo.robots,
};

export default function LandingPage() {
  const jsonLd = getLandingJsonLd(data);

  return (
    <>
      <Header brand={data.brand} header={data.header} />
      <main id="main-content">
        <Hero hero={data.hero} />
        <Stats stats={data.stats} />
        <Specialties specialties={data.specialties} />
        <Doctors doctors={data.doctors} />
        <WhyChooseUs whyChooseUs={data.whyChooseUs} />
        <Testimonials testimonials={data.testimonials} />
        <Booking booking={data.booking} />
      </main>
      <Footer brand={data.brand} footer={data.footer} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
