import { Container } from "@/components/ui/Container";
import type { ReactNode } from "react";

export function AppointmentLayout({ sidebar, content }: { sidebar: ReactNode; content: ReactNode }) {
  return (
    <Container className="py-4 md:py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="lg:col-span-4">{sidebar}</aside>
        <section className="lg:col-span-8">{content}</section>
      </div>
    </Container>
  );
}
