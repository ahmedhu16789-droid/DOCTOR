import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { LandingData } from "@/types/landing";
import Image from "next/image";

export function WhyChooseUs({ whyChooseUs }: Pick<LandingData, "whyChooseUs">) {
  return (
    <section className="bg-slate-50 py-20">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <SectionHeading eyebrow={whyChooseUs.eyebrow} title={whyChooseUs.title} description={whyChooseUs.description} />
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {whyChooseUs.features.map((feature) => (
              <li key={feature.title}>
                <p className="font-semibold text-slate-900">✦ {feature.title}</p>
                <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative h-[380px] overflow-hidden rounded-xl shadow-lg">
          <Image src={whyChooseUs.imageSrc} alt={whyChooseUs.imageAlt} fill className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" />
        </div>
      </Container>
    </section>
  );
}
