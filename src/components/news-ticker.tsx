'use client';

import { Megaphone, CheckCircle2, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TickerItem {
  id: string;
  text: string;
  href: string;
}

interface NewsTickerProps {
  items: TickerItem[];
  label?: string;
  variant?: 'active' | 'completed' | 'donation';
}

export function NewsTicker({ items, label = "Updates", variant = "active" }: NewsTickerProps) {
  if (!items || items.length === 0) return null;

  const isCompleted = variant === 'completed';
  const isDonation = variant === 'donation';

  return (
    <div className={cn(
      "border rounded-lg py-2 overflow-hidden relative flex items-center mb-2 shadow-sm",
      isCompleted ? "bg-muted/30 border-muted" : 
      isDonation ? "bg-blue-500/5 border-blue-500/10" : 
      "bg-primary/5 border-primary/10"
    )}>
      <div className={cn(
        "absolute left-0 top-0 bottom-0 z-10 px-4 flex items-center border-r shadow-md",
        isCompleted ? "bg-secondary" : "bg-background"
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-muted-foreground mr-2" />
        ) : isDonation ? (
          <DollarSign className="h-4 w-4 text-blue-600 mr-2 animate-pulse" />
        ) : (
          <Megaphone className="h-4 w-4 text-primary mr-2 animate-bounce" />
        )}
        <span className={cn(
          "text-[10px] sm:text-xs font-black uppercase tracking-tighter whitespace-nowrap",
          isCompleted ? "text-muted-foreground" : 
          isDonation ? "text-blue-600" : 
          "text-primary"
        )}>
          {label} ({items.length})
        </span>
      </div>
      <div className="flex whitespace-nowrap animate-marquee pl-[180px]">
        {items.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="mx-8 flex items-center shrink-0">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full mr-3",
              isCompleted ? "bg-muted-foreground" : 
              isDonation ? "bg-blue-400" : 
              "bg-primary animate-status-pulse"
            )} />
            <Link 
              href={item.href} 
              className={cn(
                "text-sm font-bold transition-colors decoration-primary/30 underline-offset-4 hover:underline",
                isCompleted ? "text-muted-foreground hover:text-foreground" : 
                isDonation ? "text-blue-700/80 hover:text-blue-900" : 
                "hover:text-primary"
              )}
            >
              {item.text}
            </Link>
          </div>
        ))}
        {/* Duplicate items for a truly seamless infinite loop */}
        {items.map((item, idx) => (
          <div key={`${item.id}-dup-${idx}`} className="mx-8 flex items-center shrink-0">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full mr-3",
              isCompleted ? "bg-muted-foreground" : 
              isDonation ? "bg-blue-400" : 
              "bg-primary animate-status-pulse"
            )} />
            <Link 
              href={item.href} 
              className={cn(
                "text-sm font-bold transition-colors decoration-primary/30 underline-offset-4 hover:underline",
                isCompleted ? "text-muted-foreground hover:text-foreground" : 
                isDonation ? "text-blue-700/80 hover:text-blue-900" : 
                "hover:text-primary"
              )}
            >
              {item.text}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
