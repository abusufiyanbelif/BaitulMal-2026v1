'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Quote } from 'lucide-react';
import wisdomData from '@/lib/wisdom.json';

interface Wisdom {
  quran: { text: string; source: string }[];
  hadith: { text: string; source: string }[];
  scholars: { text: string; source: string }[];
}

const typedWisdomData: Wisdom = wisdomData;

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function WisdomAndReflection() {
  const [selectedWisdom, setSelectedWisdom] = useState<{ quran: any; hadith: any; scholar: any } | null>(null);

  useEffect(() => {
    setSelectedWisdom({
      quran: getRandomItem(typedWisdomData.quran),
      hadith: getRandomItem(typedWisdomData.hadith),
      scholar: getRandomItem(typedWisdomData.scholars),
    });
  }, []);

  if (!selectedWisdom) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Quote className="h-6 w-6 text-primary" />
                    Wisdom & Reflection
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pl-10">
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-4/5" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="h-6 w-6 text-primary" />
          Wisdom & Reflection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pl-10">
        <blockquote className="border-l-2 pl-4 italic text-muted-foreground relative">
            "{selectedWisdom.quran.text}"
            <cite className="block text-right not-italic text-sm font-semibold text-foreground/80 mt-2">
                — {selectedWisdom.quran.source}
            </cite>
        </blockquote>
        <blockquote className="border-l-2 pl-4 italic text-muted-foreground relative">
            "{selectedWisdom.hadith.text}"
            <cite className="block text-right not-italic text-sm font-semibold text-foreground/80 mt-2">
                — {selectedWisdom.hadith.source}
            </cite>
        </blockquote>
        <blockquote className="border-l-2 pl-4 italic text-muted-foreground relative">
            "{selectedWisdom.scholar.text}"
            <cite className="block text-right not-italic text-sm font-semibold text-foreground/80 mt-2">
                — {selectedWisdom.scholar.source}
            </cite>
        </blockquote>
      </CardContent>
    </Card>
  );
}
