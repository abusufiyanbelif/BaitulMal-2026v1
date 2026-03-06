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
import { CheckCircle2, AlertCircle, Info } from "lucide-react"

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
        description: "The Message Has Been Copied To Your Clipboard.",
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
        const isInfo = variant === 'info';

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3 w-full">
              {isSuccess && <CheckCircle2 className="h-5 w-5 text-[#166534] shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="h-5 w-5 text-[#991B1B] shrink-0 mt-0.5" />}
              {isInfo && <Info className="h-5 w-5 text-[#0369A1] shrink-0 mt-0.5" />}
              
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
                <div className="flex gap-2 mt-3">
                  {isError && (
                    <ToastAction
                      altText="Copy error"
                      className="border-[#991B1B]/20 text-[#991B1B] hover:bg-[#991B1B]/10 hover:text-[#991B1B]"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCopy(title, description);
                      }}
                    >
                      Copy Error
                    </ToastAction>
                  )}
                  <ToastAction
                    altText="OK"
                    className={cn(
                      "bg-[#166534] text-white hover:bg-[#166534]/90 border-transparent",
                      isError && "bg-[#991B1B] text-white hover:bg-[#991B1B]/90",
                      isInfo && "bg-[#0369A1] text-white hover:bg-[#0369A1]/90"
                    )}
                  >
                    Ok
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