
'use client';
import { Button } from '@/components/ui/button';
import { PublicLeadsView } from '@/components/public-leads-view';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PublicLeadPage() {
  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
      <PublicLeadsView />
    </main>
  );
}
