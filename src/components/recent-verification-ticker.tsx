'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VerificationItem {
  id: string;
  text: string;
  href: string;
}

/**
 * A specialized vertical ticker for Recent Verifications.
 * Displays 5 items at a time with a slide-up and fade animation.
 */
export function RecentVerificationTicker({ items }: { items: VerificationItem[] }) {
  const [startIndex, setStartIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const visibleCount = 5;
  
  useEffect(() => {
    if (!items || items.length <= visibleCount) return;

    const timer = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(timer);
  }, [items, visibleCount]);

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStartIndex((prev) => (prev + 1) % items.length);
      setIsTransitioning(false);
    }, 500); 
  };

  if (!items || items.length === 0) return null;

  // Calculate the subset of items to display (circularly)
  const displayCount = Math.min(items.length, visibleCount);
  const visibleItems = [];
  for (let i = 0; i < displayCount; i++) {
    visibleItems.push(items[(startIndex + i) % items.length]);
  }

  return (
    <Card className="animate-fade-in-up border-primary/10 overflow-hidden bg-white shadow-md transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary"/> Recent Verification
        </CardTitle>
        <CardDescription className="font-normal text-primary/70">
          Secure Tracking Of Confirmed Community Contributions.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col">
            {/* Standardized Institutional Table Header */}
            <div className="grid grid-cols-[1.5fr_1fr_auto] gap-4 px-6 py-3 bg-[#ECFDF5] border-b text-[10px] font-bold text-[#14532D] tracking-widest">
                <span>Reference</span>
                <span>Allocation</span>
                <span className="text-right pr-2">Status</span>
            </div>
            
            <div className="relative overflow-hidden h-[300px]">
                <div className={cn(
                    "flex flex-col transition-all duration-500 ease-in-out h-full",
                    isTransitioning ? "opacity-0 -translate-y-4 scale-98" : "opacity-100 translate-y-0 scale-100"
                )}>
                    {visibleItems.map((item, idx) => {
                        // Extracting Name and Purpose from the formatted text
                        const parts = item.text.split(' for ');
                        const reference = parts[0] || 'N/A';
                        const allocation = parts[1] || 'General Fund';
                        
                        return (
                            <div 
                                key={`${item.id}-${idx}`}
                                className="grid grid-cols-[1.5fr_1fr_auto] gap-4 px-6 py-4 items-center border-b border-primary/5 last:border-0 hover:bg-[#F0FDF4] transition-colors h-[60px]"
                            >
                                <div className="text-xs font-bold text-primary truncate pr-2">
                                    {reference}
                                </div>
                                <Link 
                                    href={item.href} 
                                    className="text-xs font-normal text-muted-foreground hover:text-primary hover:underline transition-colors truncate tracking-tight"
                                >
                                    {allocation}
                                </Link>
                                <div className="text-right pr-2">
                                    <Badge variant="eligible" className="text-[10px] font-bold uppercase tracking-tighter">Verified</Badge>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}