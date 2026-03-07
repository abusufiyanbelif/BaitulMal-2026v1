'use client';

import React, { useState, useEffect } from 'react';
import { Megaphone, CheckCircle2, IndianRupee, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TickerItem {
  id: string;
  text: string;
  href: string;
  priorityIcon?: React.ReactNode;
}

interface NewsTickerProps {
  items: TickerItem[];
  label?: string;
  variant?: 'active' | 'completed' | 'donation';
}

/**
 * A sophisticated vertical news ticker that cycles through items with a Fade + Slide Up animation.
 * Fully theme-reactive using primary and secondary semantic variables.
 * Now supports an optional priority icon for streamlined urgent signaling.
 */
export function NewsTicker({ items, label = "Updates", variant = "active" }: NewsTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!items || items.length <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(timer);
  }, [items]);

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
      setIsTransitioning(false);
    }, 400); 
  };

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
      setIsTransitioning(false);
    }, 400);
  };

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];
  const isCompleted = variant === 'completed';
  const isDonation = variant === 'donation';

  return (
    <div className={cn(
      "group border rounded-lg overflow-hidden relative flex items-center mb-2 shadow-sm h-12 bg-white transition-all hover:shadow-md",
      isCompleted ? "border-muted" : "border-primary/10"
    )}>
      {/* Label Section - Responsive to theme primary color */}
      <div className={cn(
        "z-30 h-full px-4 flex items-center border-r shadow-md shrink-0 font-bold transition-colors duration-500",
        isCompleted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        ) : isDonation ? (
          <IndianRupee className="h-4 w-4 mr-2 animate-pulse" />
        ) : (
          <Megaphone className="h-4 w-4 mr-2" />
        )}
        <span className="text-[10px] sm:text-xs font-bold tracking-tight whitespace-nowrap uppercase">
          {label}
        </span>
      </div>

      {/* Content Section with Fade + Slide Up Animation */}
      <div className="flex-1 flex items-center px-4 relative overflow-hidden h-full">
        <div className={cn(
          "w-full transition-all duration-500 ease-in-out flex items-center gap-3",
          isTransitioning ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
        )}>
          <span className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            isCompleted ? "bg-muted-foreground" : "bg-primary"
          )} />
          
          {currentItem.priorityIcon && (
            <div className="shrink-0 flex items-center">
              {currentItem.priorityIcon}
            </div>
          )}

          <Link 
            href={currentItem.href} 
            className={cn(
              "text-sm font-bold transition-colors whitespace-nowrap hover:underline underline-offset-4 truncate",
              isCompleted ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80"
            )}
          >
            {currentItem.text}
          </Link>
        </div>
      </div>

      {/* Manual Vertical Controls */}
      <div className="z-30 flex flex-col border-l border-primary/5 h-full opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-1/2 w-8 rounded-none hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors"
          onClick={(e) => { e.preventDefault(); handleNext(); }}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-1/2 w-8 rounded-none border-t border-primary/5 hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors"
          onClick={(e) => { e.preventDefault(); handlePrev(); }}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
