import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { LandingData } from "@/types/landing";
import Link from "next/link";

export function Header({ brand, header }: Pick<LandingData, "brand" | "header">) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {header.skipToContentLabel}
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="#" className="text-lg font-bold text-slate-900">
          {brand.logoText}
        </Link>
        <nav className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-slate-600">
            {header.navLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="transition-colors hover:text-blue-600">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Button href={header.ctaHref} className="text-xs sm:text-sm">
          {header.ctaLabel}
        </Button>
      </Container>
    </header>
  );
}
