'use client';
import React, { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { PublicCampaignsView } from '@/components/public-campaigns-view';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Campaign, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { usePublicData } from '@/hooks/use-public-data';
import { BrandedLoader } from '@/components/branded-loader';

export default function PublicCampaignPage() {
  const { isLoading, campaignsWithProgress } = usePublicData();
  
  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary capitalize">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back To Home
          </Link>
        </Button>
      </div>
      <Suspense fallback={<BrandedLoader message="Synchronizing Organization Projects..." />}>
        <PublicCampaignsView />
      </Suspense>
    </main>
  );
}
