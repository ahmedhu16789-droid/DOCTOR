import { Container } from "@/components/ui/Container";
import type { LandingData } from "@/types/landing";

export function Stats({ stats }: Pick<LandingData, "stats">) {
  return (
    <section className="border-b border-slate-200 bg-white py-6">
      <Container>
        <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-md border border-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="py-6 text-center">
              <p className="text-4xl font-extrabold text-blue-600">{stat.value}</p>
              <p className="mt-1 text-xs tracking-[0.2em] text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
