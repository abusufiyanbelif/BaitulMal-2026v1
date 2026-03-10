
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
  isUrgent?: boolean;
  isHigh?: boolean;
}

interface NewsTickerProps {
  items: TickerItem[];
  label?: string;
  variant?: 'active' | 'completed' | 'donation';
}

/**
 * Vertical news ticker with "Slide Down & Slide Left" entrance animation.
 * Optimized for mobile visibility and institutional aesthetics.
 */
export function NewsTicker({ items, label = "Updates", variant = "active" }: NewsTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Prioritize sorting: Urgent > High > Others
  const sortedItems = React.useMemo(() => {
    if (variant === 'active') {
        return [...items].sort((a, b) => {
            const getScore = (item: TickerItem) => (item.isUrgent ? 2 : item.isHigh ? 1 : 0);
            return getScore(b) - getScore(a);
        });
    }
    return items;
  }, [items, variant]);

  useEffect(() => {
    if (!sortedItems || sortedItems.length <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(timer);
  }, [sortedItems]);

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % sortedItems.length);
      setIsTransitioning(false);
    }, 400); 
  };

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + sortedItems.length) % sortedItems.length);
      setIsTransitioning(false);
    }, 400);
  };

  if (!sortedItems || sortedItems.length === 0) return null;

  const currentItem = sortedItems[currentIndex];
  const isCompleted = variant === 'completed';
  const isDonation = variant === 'donation';

  return (
    <div className={cn(
      "group border rounded-lg overflow-hidden relative flex items-center mb-2 h-12 bg-white transition-all shadow-none",
      isCompleted ? "border-muted" : "border-primary/10",
      !isCompleted && currentItem?.isUrgent && "border-red-500/50",
      !isCompleted && currentItem?.isHigh && "border-orange-500/50"
    )}>
      {/* Responsive Label Section */}
      <div className={cn(
        "z-30 h-full px-2 sm:px-4 flex items-center border-r shrink-0 font-bold transition-colors duration-500",
        isCompleted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        ) : isDonation ? (
          <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-pulse" />
        ) : (
          <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        )}
        <span className="text-[9px] sm:text-xs font-bold tracking-tight whitespace-nowrap">
          {label}
        </span>
      </div>

      {/* Content Section with Slide Down & Left Animation */}
      <div className="flex-1 flex items-center px-3 sm:px-4 relative overflow-hidden h-full">
        <div 
          key={currentIndex}
          className={cn(
            "w-full flex items-center gap-2 sm:gap-3",
            "animate-in fade-in duration-1000 ease-out",
            "slide-in-from-top-12 slide-in-from-right-12" // "Slide Down and Slide Left" pronounced effect
          )}
        >
          <span className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0 hidden xs:block",
            isCompleted ? "bg-muted-foreground" : "bg-primary"
          )} />
          
          {currentItem.priorityIcon && (
            <div className="shrink-0 flex items-center [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 transition-transform duration-300 group-hover:scale-110">
              {currentItem.priorityIcon}
            </div>
          )}

          <Link 
            href={currentItem.href} 
            className={cn(
              "text-[11px] sm:text-sm font-bold transition-colors whitespace-nowrap hover:underline underline-offset-4 truncate",
              isCompleted ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80"
            )}
          >
            {currentItem.text}
          </Link>
        </div>
      </div>

      {/* Vertical Controls */}
      <div className="z-30 flex flex-col border-l border-primary/5 h-full opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex">
        <Button
          variant="ghost"
          size="icon"
          className="h-1/2 w-8 rounded-none hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors shadow-none"
          onClick={(e) => { e.preventDefault(); handleNext(); }}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-1/2 w-8 rounded-none border-t border-primary/5 hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors shadow-none"
          onClick={(e) => { e.preventDefault(); handlePrev(); }}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
