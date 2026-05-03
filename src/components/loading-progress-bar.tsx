'use client';

import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LoadingProgressBarProps {
    isLoading: boolean;
    label?: string;
}

export function LoadingProgressBar({ isLoading, label = "Synchronizing System Data..." }: LoadingProgressBarProps) {
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isLoading) {
            setVisible(true);
            const timer = setInterval(() => {
                setProgress(old => {
                    if (old >= 90) return old;
                    const diff = Math.random() * 15;
                    return Math.min(old + diff, 90);
                });
            }, 400);
            return () => clearInterval(timer);
        } else {
            setProgress(100);
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(() => setProgress(0), 300);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    if (!visible && !isLoading) return null;

    return (
        <div className={cn(
            "w-full space-y-2 mb-6 transition-all duration-500",
            !isLoading && progress === 100 ? "opacity-0 translate-y-[-10px]" : "opacity-100 translate-y-0"
        )}>
            <div className="flex justify-between items-center text-[10px] font-bold tracking-widest text-primary/40 uppercase">
                <span>{label}</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full bg-primary/5 rounded-full overflow-hidden border border-primary/10 shadow-inner">
                <Progress value={progress} className="h-full bg-primary transition-all duration-500 ease-out" />
            </div>
        </div>
    );
}
