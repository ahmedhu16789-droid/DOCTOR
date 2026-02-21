import landingJson from "@/data/clinic.landing.json";
import type { LandingData, LandingDataRaw, Locale, LocalizedValue } from "@/types/landing";
import { headers } from "next/headers";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Landing data validation error: ${message}`);
  }
}

function isLocalizedValue(value: unknown): value is LocalizedValue {
  return typeof value === "object" && value !== null && "en" in value && "ar" in value;
}

function resolveLocalized<T>(value: T, locale: Locale): T {
  if (Array.isArray(value)) return value.map((item) => resolveLocalized(item, locale)) as T;
  if (isLocalizedValue(value)) return (value[locale] ?? value.en) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, resolveLocalized(nestedValue, locale)])) as T;
  }
  return value;
}

export async function getCurrentLocale(): Promise<Locale> {
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language")?.toLowerCase() ?? "";
  return acceptLanguage.includes("ar") ? "ar" : "en";
}

export async function getLandingData(locale?: Locale): Promise<LandingData> {
  const activeLocale = locale ?? (await getCurrentLocale());
  const data = resolveLocalized(landingJson as LandingDataRaw, activeLocale) as LandingData;

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
