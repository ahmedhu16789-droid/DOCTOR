import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type BaseButtonProps = {
  children: ReactNode;
  variant?: "primary" | "outline" | "dark";
  className?: string;
};

type LinkButtonProps = BaseButtonProps & {
  href: string;
};

type ActionButtonProps = BaseButtonProps & {
  href?: never;
} & ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonProps = LinkButtonProps | ActionButtonProps;

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  outline: "border border-white/60 text-white hover:bg-white/10",
  dark: "bg-slate-900 text-white hover:bg-slate-800",
};

const sharedClass = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

export function Button({ children, variant = "primary", className = "", ...props }: ButtonProps) {
  const classes = `${sharedClass} ${variants[variant]} ${className}`;

  if ("href" in props) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={props.type ?? "button"} {...props} className={classes}>
      {children}
    </button>
  );
}
