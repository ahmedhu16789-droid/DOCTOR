export function Stepper({ steps }: { steps: string[] }) {
  return (
    <div className="mt-6 flex items-center gap-2 text-sm">
      {steps.map((step, index) => (
        <div key={step} className="contents">
          <span className={`flex items-center gap-2 ${index === 0 ? "font-bold text-blue-600" : "font-medium text-slate-500"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${index === 0 ? "bg-blue-600 text-white" : "border border-slate-300"}`}>
              {index + 1}
            </span>
            {step}
          </span>
          {index < steps.length - 1 ? <div className="h-px w-8 bg-slate-300" /> : null}
        </div>
      ))}
    </div>
  );
}
