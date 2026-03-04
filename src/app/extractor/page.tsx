'use client';
import { CreditCard, FileText, HeartPulse, User, ScanSearch, ToyBrick, BookUser, ArrowLeft } from 'lucide-react';
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
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="text" className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="h-auto bg-primary/10 p-1 w-max">
            <TabsTrigger value="text" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <FileText className="mr-2 h-5 w-5" />
                General Text
            </TabsTrigger>
            <TabsTrigger value="identity" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <User className="mr-2 h-5 w-5" />
                Identity
            </TabsTrigger>
            <TabsTrigger value="billing" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <CreditCard className="mr-2 h-5 w-5" />
                Billing
            </TabsTrigger>
            <TabsTrigger value="medical" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <HeartPulse className="mr-2 h-5 w-5" />
                Medical
            </TabsTrigger>
            <TabsTrigger value="education" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <BookUser className="mr-2 h-5 w-5" />
                Education
            </TabsTrigger>
            <TabsTrigger value="dynamic" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
                <ToyBrick className="mr-2 h-5 w-5" />
                Dynamic
            </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        <TabsContent value="text" className="mt-4">
          <TextExtractor />
        </TabsContent>
        <TabsContent value="identity" className="mt-4">
          <IdentityExtractor />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <BillingExtractor />
        </TabsContent>
        <TabsContent value="medical" className="mt-4">
          <MedicalExtractor />
        </TabsContent>
        <TabsContent value="education" className="mt-4">
          <EducationExtractor />
        </TabsContent>
        <TabsContent value="dynamic" className="mt-4">
          <DynamicExtractor />
        </TabsContent>
      </Tabs>
    </div>
  );
}