import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "dark";
  className?: string;
};

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  outline: "border border-white/60 text-white hover:bg-white/10",
  dark: "bg-slate-900 text-white hover:bg-slate-800",
};

export function Button({ href, children, variant = "primary", className = "" }: ButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
