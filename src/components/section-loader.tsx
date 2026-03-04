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
 * Now supports an optional progress percentage for deterministic feedback.
 */
export function SectionLoader({ label, description, progress }: SectionLoaderProps) {
  return (
    <div className="w-full py-12 flex flex-col items-center justify-center space-y-4 animate-fade-in-up">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <h3 className="text-sm font-bold tracking-tight">
            {label} {progress !== undefined && <span className="ml-1 text-xs">({Math.round(progress)}%)</span>}
          </h3>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground font-normal">
            {description}
          </p>
        )}
      </div>
      <div className="w-full max-w-md px-4">
        <Progress value={progress} className="h-1.5 w-full bg-primary/10" />
      </div>
    </div>
  );
}
