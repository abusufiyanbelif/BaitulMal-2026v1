
'use client';

import { Megaphone } from 'lucide-react';
import Link from 'next/link';

interface TickerItem {
  id: string;
  text: string;
  href: string;
}

export function NewsTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-primary/5 border rounded-lg py-2 overflow-hidden relative flex items-center mb-6 shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 bg-background z-10 px-4 flex items-center border-r shadow-md">
        <Megaphone className="h-4 w-4 text-primary mr-2 animate-bounce" />
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-tighter whitespace-nowrap text-primary">
          Live Updates
        </span>
      </div>
      <div className="flex whitespace-nowrap animate-marquee pl-[120px]">
        {items.map((item) => (
          <div key={item.id} className="mx-8 flex items-center shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mr-3 animate-status-pulse" />
            <Link 
              href={item.href} 
              className="text-sm font-bold hover:text-primary transition-colors decoration-primary/30 underline-offset-4 hover:underline"
            >
              {item.text}
            </Link>
          </div>
        ))}
        {/* Duplicate items for a truly seamless infinite loop */}
        {items.map((item) => (
          <div key={`${item.id}-dup`} className="mx-8 flex items-center shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mr-3 animate-status-pulse" />
            <Link 
              href={item.href} 
              className="text-sm font-bold hover:text-primary transition-colors decoration-primary/30 underline-offset-4 hover:underline"
            >
              {item.text}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
