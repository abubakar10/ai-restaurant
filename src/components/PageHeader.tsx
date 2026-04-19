import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {meta ? (
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {meta}
        </div>
      ) : null}
    </header>
  );
}
