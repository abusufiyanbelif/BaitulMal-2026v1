'use client';
import { CreditCard, FileText, HeartPulse, User, ToyBrick, BookUser, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextExtractor } from '@/components/text-extractor';
import { IdentityExtractor } from '@/components/identity-extractor';
import { BillingExtractor } from '@/components/billing-extractor';
import { MedicalExtractor } from '@/components/medical-extractor';
import { DynamicExtractor } from '@/components/dynamic-extractor';
import { EducationExtractor } from '@/components/education-extractor';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useSession } from '@/hooks/use-session';
import { SectionLoader } from '@/components/section-loader';

export default function ExtractorPage() {
  const { isLoading } = useSession();

  if (isLoading) {
    return <SectionLoader label="Initializing extractor..." description="Preparing AI models and document processing environment." />;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild className="active:scale-95 transition-transform border-primary/20 text-primary font-bold">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="text" className="w-full">
        <ScrollArea className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 h-auto w-full bg-transparent p-0">
                <TabsTrigger value="text" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <FileText className="mr-2 h-4 w-4" />
                    General text
                </TabsTrigger>
                <TabsTrigger value="identity" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <User className="mr-2 h-4 w-4" />
                    Identity
                </TabsTrigger>
                <TabsTrigger value="billing" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                </TabsTrigger>
                <TabsTrigger value="medical" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <HeartPulse className="mr-2 h-4 w-4" />
                    Medical
                </TabsTrigger>
                <TabsTrigger value="education" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <BookUser className="mr-2 h-4 w-4" />
                    Education
                </TabsTrigger>
                <TabsTrigger value="dynamic" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <ToyBrick className="mr-2 h-4 w-4" />
                    Dynamic
                </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
        
        <TabsContent value="text" className="mt-8">
          <TextExtractor />
        </TabsContent>
        <TabsContent value="identity" className="mt-8">
          <IdentityExtractor />
        </TabsContent>
        <TabsContent value="billing" className="mt-8">
          <BillingExtractor />
        </TabsContent>
        <TabsContent value="medical" className="mt-8">
          <MedicalExtractor />
        </TabsContent>
        <TabsContent value="education" className="mt-8">
          <EducationExtractor />
        </TabsContent>
        <TabsContent value="dynamic" className="mt-8">
          <DynamicExtractor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
