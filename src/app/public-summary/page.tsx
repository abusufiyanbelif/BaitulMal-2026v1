'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, FolderKanban, Lightbulb } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PublicCampaignsView } from '@/components/public-campaigns-view';
import { PublicLeadsView } from '@/components/public-leads-view';

export default function PublicSummaryPage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild className="active:scale-95 transition-transform border-primary/20 text-primary font-bold">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back To Dashboard
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="campaigns" className="font-bold"><FolderKanban className="mr-2 h-4 w-4" /> Public Campaigns</TabsTrigger>
          <TabsTrigger value="leads" className="font-bold"><Lightbulb className="mr-2 h-4 w-4" /> Public Leads</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" className="mt-4">
          <PublicCampaignsView />
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          <PublicLeadsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
