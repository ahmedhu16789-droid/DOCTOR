import type { SelectHTMLAttributes } from "react";

export function Select({ children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 p-3 pr-10 text-sm text-slate-900 focus:border-blue-600 focus:outline-none ${className}`}
    >
      {children}
    </select>
  );
}
