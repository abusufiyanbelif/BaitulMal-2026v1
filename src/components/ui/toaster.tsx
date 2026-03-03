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
    } else {
      showToast({
        title: "Nothing to copy",
        description: "The toast content could not be copied as text.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isConfirmationToast = props.duration && props.duration <= 3000;
        
        const showCustomButtons = !isConfirmationToast && ['default', 'success', 'destructive'].includes(props.variant || 'default');

        return (
          <Toast key={id} {...props}>
            <div className="w-full grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
               {showCustomButtons ? (
                <div className="mt-4 flex gap-2">
                    <ToastAction
                        altText="Copy"
                        className={cn(
                            "border-primary text-primary hover:bg-primary hover:text-white transition-all",
                            props.variant === 'destructive' && "border-destructive text-destructive hover:bg-destructive hover:text-white"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          handleCopy(title, description);
                        }}
                      >
                        Copy
                      </ToastAction>
                      <ToastAction
                        altText="OK"
                        className={cn(
                            "bg-primary text-white hover:bg-primary/90 transition-all border-transparent",
                            props.variant === 'destructive' && "bg-destructive text-white hover:bg-destructive/90"
                        )}
                      >
                        OK
                      </ToastAction>
                </div>
              ) : (
                action && <div className="mt-4 flex gap-2">{action}</div>
              )}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}