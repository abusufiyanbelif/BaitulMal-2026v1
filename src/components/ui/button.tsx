import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-px hover:shadow-[0_6px_14px_rgba(0,0,0,0.12)] font-medium rounded-[12px] px-5 py-3",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm rounded-[10px]",
        outline:
          "border border-primary/20 bg-transparent text-primary hover:bg-primary/5 rounded-[10px] font-medium",
        secondary:
          "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-[10px] font-medium shadow-sm",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground rounded-[8px]",
        link: "text-primary underline-offset-4 hover:underline rounded-[8px]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 p-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
