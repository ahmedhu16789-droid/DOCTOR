import { Container } from "@/components/ui/Container";
import type { LandingData } from "@/types/landing";

export function Footer({ brand, footer }: Pick<LandingData, "brand" | "footer">) {
  return (
    <footer className="bg-slate-950 py-14 text-slate-300">
      <Container>
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="text-lg font-bold text-white">{brand.logoText}</p>
            <p className="mt-4 text-sm text-slate-400">{footer.description}</p>
            <div className="mt-4 flex gap-2">
              {footer.socialLinks.map((link) => (
                <a key={link.label} href={link.href} aria-label={link.label} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-blue-600">
                  {link.short}
                </a>
              ))}
            </div>
          </div>
          {footer.columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{column.title}</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-slate-400 transition hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-slate-800 pt-6 text-xs text-slate-500 md:flex md:items-center md:justify-between">
          <p>{footer.copyright}</p>
          <p>{footer.credits}</p>
        </div>
      </Container>
    </footer>
  );
}
