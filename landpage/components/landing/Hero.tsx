import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { LandingData } from "@/types/landing";
import Image from "next/image";

export function Hero({ hero }: Pick<LandingData, "hero">) {
  const [before, after] = hero.title.split(hero.highlight);

  return (
    <section className="relative overflow-hidden py-24">
      <Image
        src={hero.backgroundImage}
        alt={hero.backgroundAlt}
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/65 to-slate-900/20" />
      <Container className="relative">
        <div className="max-w-xl text-white">
          <p className="inline-block rounded-full bg-blue-500/30 px-3 py-1 text-xs font-semibold tracking-wide">{hero.badge}</p>
          <h1 className="mt-6 text-5xl font-extrabold leading-tight">
            {before}
            <span className="block text-blue-400">{after ? hero.highlight + after : hero.highlight}</span>
          </h1>
          <p className="mt-4 text-base text-blue-50">{hero.description}</p>
          <div className="mt-8 flex gap-3">
            <Button href={hero.primaryCta.href}>{hero.primaryCta.label}</Button>
            <Button href={hero.secondaryCta.href} variant="outline">
              {hero.secondaryCta.label}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
