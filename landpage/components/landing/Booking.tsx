import { Container } from "@/components/ui/Container";
import type { BookingField, LandingData } from "@/types/landing";

function renderField(field: BookingField) {
  const base = "mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  if (field.type === "select") {
    return (
      <select id={field.name} name={field.name} required={field.required} defaultValue="" className={base}>
        <option value="" disabled>
          {field.placeholder}
        </option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return <input id={field.name} name={field.name} type={field.type} required={field.required} placeholder={field.placeholder} className={base} />;
}

export function Booking({ booking }: Pick<LandingData, "booking">) {
  return (
    <section id="booking" className="bg-blue-600 py-20 text-white">
      <Container className="grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">{booking.eyebrow}</p>
          <h2 className="mt-3 text-5xl font-bold leading-tight">{booking.title}</h2>
          <p className="mt-4 max-w-md text-blue-100">{booking.description}</p>
          <div className="mt-8 space-y-2 text-sm text-blue-100" id="contact">
            <p>{booking.contact.phone}</p>
            <p>{booking.contact.address}</p>
            <p>{booking.contact.email}</p>
            <p>{booking.contact.hours}</p>
          </div>
        </div>
        <form className="rounded-xl bg-white p-6 text-slate-800 shadow-2xl">
          <h3 className="text-lg font-semibold">{booking.formTitle}</h3>
          <div className="mt-4 grid gap-4">
            {booking.fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {field.label}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
          <button type="submit" className="mt-5 h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {booking.submitLabel}
          </button>
        </form>
      </Container>
    </section>
  );
}
