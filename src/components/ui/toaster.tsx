"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertCircle } from "lucide-react"

export function Toaster() {
  const { toasts, toast: showToast } = useToast()

  const handleCopy = (title?: React.ReactNode, description?: React.ReactNode) => {
    const textToCopy = [
      typeof title === 'string' ? title : '',
      typeof description === 'string' ? description : ''
    ].filter(Boolean).join('\n');

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      showToast({
        title: "Copied!",
        description: "The message has been copied to your clipboard.",
        variant: "success",
        duration: 2000,
      });
    }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isError = variant === 'destructive';
        const isSuccess = variant === 'success';

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3 w-full">
              {isSuccess && <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
              
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
                <div className="flex gap-2 mt-3">
                  {isError && (
                    <ToastAction
                      altText="Copy error"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCopy(title, description);
                      }}
                    >
                      Copy
                    </ToastAction>
                  )}
                  <ToastAction
                    altText="OK"
                    className={cn(
                      "bg-primary text-white hover:bg-primary/90 border-transparent",
                      isError && "bg-destructive text-white hover:bg-destructive/90"
                    )}
                  >
                    OK
                  </ToastAction>
                </div>
              </div>
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}