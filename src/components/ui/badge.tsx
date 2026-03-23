import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
        outline: "text-foreground border-primary/20",
        eligible: "border-transparent bg-[hsl(var(--badge-eligible-bg))] text-[hsl(var(--badge-eligible-fg))] rounded-[20px] px-[10px] py-[4px]",
        given: "border-transparent bg-[hsl(var(--badge-given-bg))] text-[hsl(var(--badge-given-fg))] px-[10px] py-[4px]",
        active: "border-transparent bg-[hsl(var(--badge-active-bg))] text-[hsl(var(--badge-active-fg))] px-[10px] py-[4px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  let finalVariant = variant;

  if (!variant || variant === 'default' || variant === 'outline' || variant === 'success') {
    if (typeof children === 'string') {
        const lowerContent = children.trim().toLowerCase();
        if (lowerContent === 'eligible' || lowerContent === 'verified' || lowerContent === 'success' || lowerContent.includes('published')) {
            finalVariant = 'eligible';
        } else if (lowerContent === 'given' || lowerContent === 'completed' || lowerContent === 'rejected') {
            finalVariant = 'given';
        } else if (lowerContent === 'active' || lowerContent === 'upcoming' || lowerContent.includes('ready')) {
            finalVariant = 'active';
        }
    }
  }

  let displayChildren = children;
  if (typeof children === 'string' && children.trim().length > 0) {
      const content = children.trim();
      displayChildren = content
        .split(' ')
        .map(word => {
            // Keep specific acronyms uppercase
            const lower = word.toLowerCase();
            if (['upi', 'pan', 'ifsc', 'id', 'pwa', 'ssr', 'ocr', 'gpay', 'utr', 'png', 'pdf', 'csv', 'json'].includes(lower)) return word.toUpperCase();
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
  }

  return (
    <div className={cn(badgeVariants({ variant: finalVariant }), className)} {...props}>
        {displayChildren}
    </div>
  )
}

export { Badge, badgeVariants }
