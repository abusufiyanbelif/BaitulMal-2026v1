
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Quote } from 'lucide-react';
import wisdomData from '@/lib/wisdom.json';

interface Wisdom {
  quran: { text: string; source: string }[];
  hadith: { text: string; source: string }[];
  scholars?: { text: string; source: string }[];
}

const typedWisdomData: Wisdom = wisdomData;

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function WisdomAndReflection() {
  const [selectedWisdom, setSelectedWisdom] = useState<{ quran: any; reflection: any; } | null>(null);

  useEffect(() => {
    // This effect now runs only once after the component mounts on the client.
    const reflections = [
        ...(typedWisdomData.hadith || []),
        ...(typedWisdomData.scholars || []),
    ];

    setSelectedWisdom({
      quran: getRandomItem(typedWisdomData.quran),
      reflection: reflections.length > 0 ? getRandomItem(reflections) : null,
    });
  }, []); // Empty dependency array ensures this runs only once.

  if (!selectedWisdom) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Quote className="h-6 w-6 text-primary" />
                    Hikmat aur Fikr
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pl-10">
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-8 w-3/4" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="h-6 w-6 text-primary" />
          Hikmat aur Fikr
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pl-10">
        {selectedWisdom.quran && (
            <blockquote className="border-l-2 pl-4 italic text-muted-foreground relative">
                "{selectedWisdom.quran.text}"
                <cite className="block text-right not-italic text-sm font-semibold text-foreground/80 mt-2">
                    — {selectedWisdom.quran.source}
                </cite>
            </blockquote>
        )}
        {selectedWisdom.reflection && (
            <blockquote className="border-l-2 pl-4 italic text-muted-foreground relative">
                "{selectedWisdom.reflection.text}"
                <cite className="block text-right not-italic text-sm font-semibold text-foreground/80 mt-2">
                    — {selectedWisdom.reflection.source}
                </cite>
            </blockquote>
        )}
      </CardContent>
    </Card>
  );
}
