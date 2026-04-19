import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-violet-500/30 bg-violet-500/15 text-violet-200",
        success:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
        warning:
          "border-amber-500/35 bg-amber-500/15 text-amber-100",
        danger:
          "border-rose-500/35 bg-rose-500/15 text-rose-100",
        muted: "border-white/10 bg-white/5 text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
