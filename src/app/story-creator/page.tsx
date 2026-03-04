'use client';
import { HeartPulse, BookUser, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MedicalExtractor } from '@/components/medical-extractor';
import { EducationExtractor } from '@/components/education-extractor';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function StoryCreatorPage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
              <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to dashboard
              </Link>
          </Button>
      </div>
      <Tabs defaultValue="medical" className="w-full">
        <ScrollArea className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2 h-auto w-full bg-transparent p-0">
                <TabsTrigger value="medical" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <HeartPulse className="mr-2 h-4 w-4" />
                    Medical
                </TabsTrigger>
                <TabsTrigger value="education" className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold">
                    <BookUser className="mr-2 h-4 w-4" />
                    Education
                </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
        <TabsContent value="medical" className="mt-8">
          <MedicalExtractor enableStoryCreator={true} />
        </TabsContent>
         <TabsContent value="education" className="mt-8">
          <EducationExtractor enableStoryCreator={true} />
         </TabsContent>
      </Tabs>
    </div>
  );
}
