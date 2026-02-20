export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "text-center" : ""}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
      {description ? <p className="mt-3 max-w-2xl text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}
