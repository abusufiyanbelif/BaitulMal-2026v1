
'use client';
import { HeartPulse, BookUser, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MedicalExtractor } from '@/components/medical-extractor';
import { EducationExtractor } from '@/components/education-extractor';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function StoryCreatorPage() {
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
      <Tabs defaultValue="medical" className="w-full">
        <TabsList className="h-auto bg-primary/10 p-1">
          <TabsTrigger value="medical" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <HeartPulse className="mr-2 h-5 w-5" />
            Medical
          </TabsTrigger>
          <TabsTrigger value="education" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BookUser className="mr-2 h-5 w-5" />
            Education
          </TabsTrigger>
        </TabsList>
        <TabsContent value="medical" className="mt-4">
          <MedicalExtractor enableStoryCreator={true} />
        </TabsContent>
         <TabsContent value="education" className="mt-4">
          <EducationExtractor enableStoryCreator={true} />
         </TabsContent>
      </Tabs>
    </main>
  );
}
