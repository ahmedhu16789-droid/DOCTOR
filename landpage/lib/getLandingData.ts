import landingJson from "@/data/clinic.landing.json";
import type { LandingData } from "@/types/landing";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Landing data validation error: ${message}`);
  }
}

export function getLandingData(): LandingData {
  const data = landingJson as LandingData;

  assert(data.hero?.title, "hero.title is required");
  assert(Array.isArray(data.header?.navLinks), "header.navLinks must be an array");
  assert(Array.isArray(data.stats) && data.stats.length === 3, "stats must contain exactly 3 items");
  assert(Array.isArray(data.specialties?.items) && data.specialties.items.length === 3, "specialties.items must contain exactly 3 specialties");
  assert(Array.isArray(data.doctors?.items) && data.doctors.items.length === 3, "doctors.items must contain exactly 3 doctors");
  assert(Array.isArray(data.testimonials?.items) && data.testimonials.items.length === 2, "testimonials.items must contain exactly 2 testimonials");
  assert(data.appointmentPage?.booking?.pageTitle, "appointmentPage.booking.pageTitle is required");
  assert(Array.isArray(data.appointmentPage?.physicians) && data.appointmentPage.physicians.length > 0, "appointmentPage.physicians must contain at least 1 physician");

  return data;
}
