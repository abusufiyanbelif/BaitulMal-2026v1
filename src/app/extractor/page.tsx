
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

export default function ExtractorPage() {
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
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="h-auto bg-primary/10 p-1">
          <TabsTrigger value="text" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="mr-2 h-5 w-5" />
            General Text
          </TabsTrigger>
          <TabsTrigger value="identity" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="mr-2 h-5 w-5" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="billing" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CreditCard className="mr-2 h-5 w-5" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="medical" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <HeartPulse className="mr-2 h-5 w-5" />
            Medical
          </TabsTrigger>
          <TabsTrigger value="education" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BookUser className="mr-2 h-5 w-5" />
            Education
          </TabsTrigger>
          <TabsTrigger value="dynamic" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ToyBrick className="mr-2 h-5 w-5" />
            Dynamic
          </TabsTrigger>
        </TabsList>
        
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
    </main>
  );
}
