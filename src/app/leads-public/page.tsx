'use client';
import { Button } from '@/components/ui/button';
import { PublicLeadsView } from '@/components/public-leads-view';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePublicData } from '@/hooks/use-public-data';

export default function PublicLeadPage() {
  const { isLoading, leadsWithProgress } = usePublicData();
  
  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back To Home
          </Link>
        </Button>
      </div>
      <PublicLeadsView />
    </main>
  );
}
