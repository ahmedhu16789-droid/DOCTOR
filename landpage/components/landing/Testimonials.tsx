import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { LandingData } from "@/types/landing";
import Image from "next/image";

export function Testimonials({ testimonials }: Pick<LandingData, "testimonials">) {
  return (
    <section id="testimonials" className="bg-white py-20">
      <Container>
        <SectionHeading eyebrow={testimonials.eyebrow} title={testimonials.title} centered />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {testimonials.items.map((item) => (
            <article key={item.patientName} className="relative rounded-xl bg-slate-50 p-8">
              <span className="pointer-events-none absolute right-6 top-4 text-7xl font-black text-blue-100">”</span>
              <p className="relative text-sm leading-7 text-slate-600">{item.quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <Image src={item.avatarSrc} alt={item.avatarAlt} width={40} height={40} className="rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.patientName}</p>
                  <p className="text-xs text-slate-500">{item.patientRole}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
