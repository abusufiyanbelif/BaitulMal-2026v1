'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Megaphone, CheckCircle2, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  const isCompleted = variant === 'completed';
  const isDonation = variant === 'donation';

  // Triple items for a truly seamless loop
  const displayItems = [...items, ...items, ...items];

  return (
    <div className={cn(
      "group border rounded-lg overflow-hidden relative flex items-center mb-2 shadow-sm h-12 transition-all hover:shadow-md bg-background",
      isCompleted ? "border-muted" : 
      isDonation ? "border-blue-500/10" : 
      "border-primary/10"
    )}>
      <div className={cn(
        "z-30 h-full px-4 flex items-center border-r shadow-md shrink-0",
        isCompleted ? "bg-muted text-muted-foreground" : 
        isDonation ? "bg-blue-600 text-white" : 
        "bg-[#1b9d4a] text-white"
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        ) : isDonation ? (
          <DollarSign className="h-4 w-4 mr-2 animate-pulse" />
        ) : (
          <Megaphone className="h-4 w-4 mr-2" />
        )}
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-tighter whitespace-nowrap">
          {label} ({items.length})
        </span>
      </div>

      <div className="absolute right-2 z-40 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 rounded-full shadow-sm"
          onClick={(e) => { e.preventDefault(); scroll('left'); }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 rounded-full shadow-sm"
          onClick={(e) => { e.preventDefault(); scroll('right'); }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex-1 flex items-center overflow-hidden relative"
      >
        <div 
          className="flex items-center gap-4 animate-marquee whitespace-nowrap h-full"
          style={{ '--duration': `${Math.max(40, items.length * 15)}s` } as React.CSSProperties}
        >
          {displayItems.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex items-center shrink-0 pr-8 border-r border-dashed border-muted-foreground/20 last:border-0 h-full py-3">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full mr-3 shrink-0",
                isCompleted ? "bg-muted-foreground" : 
                isDonation ? "bg-blue-400" : 
                "bg-[#1b9d4a]"
              )} />
              <Link 
                href={item.href} 
                className={cn(
                  "text-sm font-bold transition-colors whitespace-nowrap hover:underline underline-offset-4",
                  isCompleted ? "text-muted-foreground hover:text-foreground" : 
                  isDonation ? "text-blue-700/80 hover:text-blue-900" : 
                  "text-foreground hover:text-[#1b9d4a]"
                )}
              >
                {item.text}
              </Link>
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none z-20" />
    </div>
  );
}