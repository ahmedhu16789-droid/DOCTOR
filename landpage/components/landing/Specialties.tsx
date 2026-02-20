import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { LandingData, Specialty } from "@/types/landing";

const iconMap: Record<Specialty["iconName"], string> = {
  orthopedics: "✚",
  dentistry: "🦷",
  ophthalmology: "◉",
};

export function Specialties({ specialties }: Pick<LandingData, "specialties">) {
  return (
    <section id="specialties" className="bg-slate-50 py-20">
      <Container>
        <div className="mb-10 flex items-end justify-between gap-4">
          <SectionHeading eyebrow={specialties.eyebrow} title={specialties.title} description={specialties.description} />
          <a href={specialties.viewAllHref} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            {specialties.viewAllLabel} +
          </a>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {specialties.items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700" aria-label={item.title}>
                {iconMap[item.iconName]}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              <a href={item.href} className="mt-4 inline-block text-sm font-semibold text-blue-600">
                {specialties.learnMoreLabel} +
              </a>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
