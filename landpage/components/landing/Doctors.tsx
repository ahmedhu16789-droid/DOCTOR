import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { LandingData } from "@/types/landing";
import Image from "next/image";

export function Doctors({ doctors }: Pick<LandingData, "doctors">) {
  return (
    <section id="doctors" className="bg-white py-20">
      <Container>
        <SectionHeading eyebrow={doctors.eyebrow} title={doctors.title} description={doctors.description} centered />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {doctors.items.map((doctor) => (
            <article key={doctor.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="relative h-72">
                <Image src={doctor.imageSrc} alt={doctor.imageAlt} fill className="object-cover" sizes="(min-width: 768px) 33vw, 100vw" />
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{doctor.name}</h3>
                  <p className="text-sm text-blue-600">{doctor.specialty}</p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">{doctor.experienceLabel}</span>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
