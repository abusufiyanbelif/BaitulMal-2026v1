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
        // Semantic Status Variants - Theme Reactive
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

function Badge({ className, variant, ...props }: BadgeProps) {
  const content = typeof props.children === 'string' ? props.children.trim() : '';
  let finalVariant = variant;

  // Title Case Conversion for automatic statuses
  const displayContent = content.charAt(0).toUpperCase() + content.slice(1).toLowerCase();

  // Automatic semantic mapping based on institutional keywords
  if (!variant || variant === 'default' || variant === 'outline' || variant === 'success') {
    const lowerContent = displayContent.toLowerCase();
    if (lowerContent === 'eligible' || lowerContent === 'verified' || lowerContent === 'success') {
        finalVariant = 'eligible';
    } else if (lowerContent === 'given' || lowerContent === 'completed') {
        finalVariant = 'given';
    } else if (lowerContent === 'active' || lowerContent === 'upcoming') {
        finalVariant = 'active';
    }
  }

  return (
    <div className={cn(badgeVariants({ variant: finalVariant }), className)} {...props}>
        {displayContent}
    </div>
  )
}

export { Badge, badgeVariants }
