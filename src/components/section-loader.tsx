'use client';

import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface SectionLoaderProps {
  label: string;
  description?: string;
  progress?: number;
}

/**
 * A branded section-level loader that identifies exactly what component is being loaded.
 * Labels follow the professional Title Case typography standard.
 */
export function SectionLoader({ label, description, progress }: SectionLoaderProps) {
  return (
    <div className="w-full py-12 flex flex-col items-center justify-center space-y-6 animate-fade-in-up">
      <div className="flex flex-col items-center gap-2 text-center px-4">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <h3 className="text-sm font-bold tracking-tight">
            {label}
          </h3>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground font-normal">
            {description}
          </p>
        )}
        {progress !== undefined && (
          <span className="text-[10px] font-bold text-primary/60 tracking-tight">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="w-full max-w-md px-6">
        <Progress value={progress} className="h-1.5 w-full bg-primary/10" />
      </div>
    </div>
  );
}
