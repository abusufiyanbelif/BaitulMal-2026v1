
'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Quote, Target, Loader2, CheckCircle2, XCircle, BookOpen, ListChecks } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useInfoSettings } from '@/hooks/use-info-settings';
import { useDonationInfo } from '@/hooks/use-donation-info';
import { defaultDonationInfo } from '@/lib/donation-info-default';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const comparisonData = [
    { feature: 'Status', zakat: 'Obligatory (Fard)', sadaqah: 'Voluntary', lillah: 'Voluntary', fidiya: 'Obligatory Compensation', interest: 'Mandatory disposal' },
    { feature: 'Amount', zakat: 'Fixed (2.5%)', sadaqah: 'Any amount', lillah: 'Any amount', fidiya: 'Fixed per missed fast', interest: 'Total amount earned' },
    { feature: 'Recipient', zakat: 'Specific 8 categories', sadaqah: 'Anyone in need', lillah: 'Institutions/Public', fidiya: 'Poor & Needy', interest: 'Public welfare' },
];

export default function DonationInfoPage() {
    const { infoSettings, isLoading: isInfoLoading } = useInfoSettings();
    const { donationInfoData, isLoading: isContentLoading } = useDonationInfo();

    const isLoading = isInfoLoading || isContentLoading;
    const donationTypes = (donationInfoData?.types && donationInfoData.types.length > 0) 
        ? donationInfoData.types 
        : defaultDonationInfo;

    if (isLoading) {
        return (
             <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!infoSettings?.isDonationInfoPublic) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <h1 className="text-2xl font-bold">Page Not Available</h1>
                <p className="text-muted-foreground mt-2">This informational page is not currently public.</p>
                 <Button asChild className="mt-6">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back to Home
                    </Link>
                </Button>
            </main>
        );
    }

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-12">
      <div className="mb-4">
        <Button variant="outline" asChild className="active:scale-95 transition-transform">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <section className="text-center space-y-4 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-primary uppercase">Financial Wisdom in Islam</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium">
              Understanding the distinct categories of charitable giving ensures your contributions are used correctly and fulfill their intended religious purposes.
          </p>
      </section>

      <Tabs defaultValue={donationTypes[0]?.id} className="max-w-5xl mx-auto">
        <div className="flex justify-center mb-8">
            <ScrollArea className="w-full sm:w-auto">
                <TabsList className="bg-muted/50 p-1">
                    {donationTypes.map((type) => (
                        <TabsTrigger key={type.id} value={type.id} className="px-6 py-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            {type.id.toUpperCase()}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        {donationTypes.map((type) => {
            const displayImageUrl = type.imageUrl ? (type.imageUrl.startsWith('data:') ? type.imageUrl : `/api/image-proxy?url=${encodeURIComponent(type.imageUrl)}`) : `https://picsum.photos/seed/${type.id}/800/600`;

            return (
                <TabsContent key={type.id} value={type.id} className="animate-fade-in-up">
                    <Card className="overflow-hidden border-none shadow-2xl">
                        <div className="relative h-64 md:h-80 w-full flex items-center justify-center bg-secondary/20">
                            <Image src={displayImageUrl} alt={type.title} fill className="object-cover" priority />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-8 left-8 text-white pr-8">
                                <h2 className="text-4xl font-black tracking-tight drop-shadow-xl uppercase">{type.title}</h2>
                            </div>
                        </div>
                        <CardContent className="p-8 md:p-12 space-y-10">
                            <div className="grid md:grid-cols-3 gap-10">
                                <div className="md:col-span-2 space-y-8">
                                    <div className="space-y-4">
                                        <p className="text-xl leading-relaxed text-foreground font-semibold">{type.description}</p>
                                        
                                        {type.quranVerse && (
                                            <blockquote className="border-l-4 border-primary pl-6 py-4 italic text-muted-foreground relative bg-muted/30 rounded-r-xl">
                                                <Quote className="h-6 w-6 text-primary/20 absolute -top-3 -left-3" />
                                                <p className="text-lg leading-relaxed">"{type.quranVerse}"</p>
                                                {type.quranSource && (
                                                    <cite className="block text-right not-italic text-sm font-black text-primary mt-4 tracking-widest uppercase">
                                                        — {type.quranSource}
                                                    </cite>
                                                )}
                                            </blockquote>
                                        )}
                                    </div>

                                    {type.useCases && type.useCases.length > 0 && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-black tracking-tight text-primary uppercase flex items-center gap-3">
                                                <Target className="h-6 w-6" /> {type.useCasesHeading || "Practical Use Cases"}
                                            </h3>
                                            <div className="grid gap-4">
                                                {type.useCases.map((useCase) => (
                                                    <div key={useCase.id} className="group p-4 rounded-xl border-2 border-muted bg-card hover:border-primary/30 transition-all">
                                                        <div className="flex items-start gap-4">
                                                            <div className="mt-1">
                                                                {useCase.isAllowed ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-red-500" />}
                                                            </div>
                                                            <div className="space-y-1">
                                                                <h4 className="font-black text-lg uppercase tracking-tight">{useCase.title}</h4>
                                                                <p className="text-muted-foreground font-medium">{useCase.description}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-8">
                                    {type.purposePoints && type.purposePoints.length > 0 && (
                                        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                                            <h4 className="font-black text-xs uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                                                <ListChecks className="h-4 w-4" /> Key Highlights
                                            </h4>
                                            <ul className="space-y-3">
                                                {type.purposePoints.map((point, pIdx) => (
                                                    <li key={pIdx} className="flex items-center gap-3 text-sm font-bold">
                                                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        <div className="p-4 rounded-xl bg-muted/20 border">
                                            <span className="font-black uppercase text-[10px] tracking-widest text-muted-foreground block mb-2">Permissible Usage:</span>
                                            <p className="text-sm font-medium leading-relaxed">{type.usage}</p>
                                        </div>
                                        {type.restrictions && (
                                            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                                                <span className="font-black uppercase text-[10px] tracking-widest text-destructive block mb-2">Strict Restrictions:</span>
                                                <p className="text-sm font-medium leading-relaxed text-destructive/80">{type.restrictions}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {type.qaItems && type.qaItems.length > 0 && (
                                <div className="space-y-8 pt-6 border-t">
                                    <h3 className="text-2xl font-black tracking-tight text-blue-600 uppercase flex items-center gap-3">
                                        <BookOpen className="h-6 w-6" /> Common Questions
                                    </h3>
                                    <div className="grid sm:grid-cols-2 gap-6">
                                        {type.qaItems.map((qa) => (
                                            <div key={qa.id} className="space-y-3 bg-blue-50/30 p-6 rounded-2xl border border-blue-100/50">
                                                <h4 className="font-black text-lg text-blue-900">Q: {qa.question}</h4>
                                                <p className="font-medium text-slate-700">A: {qa.answer}</p>
                                                {qa.reference && (
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest pt-2">Ref: {qa.reference}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            );
        })}
      </Tabs>

      <section className="max-w-5xl mx-auto space-y-6 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <div className="text-center space-y-2">
              <h2 className="text-3xl font-black tracking-tight uppercase">Quick Comparison</h2>
              <p className="text-muted-foreground font-medium">Identifying the primary differences at a glance.</p>
          </div>
          <Card className="shadow-xl overflow-hidden border-primary/10">
              <Table>
                  <TableHeader className="bg-primary/5">
                  <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-wider w-[150px]">Feature</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-wider">Zakat</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-wider">Sadaqah</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-wider">Lillah</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-wider">Fidiya</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {comparisonData.map((row) => (
                      <TableRow key={row.feature} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-bold text-xs bg-muted/20 uppercase">{row.feature}</TableCell>
                      <TableCell className="text-xs font-medium">{row.zakat}</TableCell>
                      <TableCell className="text-xs font-medium">{row.sadaqah}</TableCell>
                      <TableCell className="text-xs font-medium">{row.lillah}</TableCell>
                      <TableCell className="text-xs font-medium">{row.fidiya}</TableCell>
                      </TableRow>
                  ))}
                  </TableBody>
              </Table>
          </Card>
      </section>

      <div className="max-w-5xl mx-auto">
        <Alert className="bg-primary/5 border-primary/20 p-6 rounded-2xl shadow-sm">
            <AlertCircle className="h-6 w-6 text-primary" />
            <AlertTitle className="font-black uppercase text-sm tracking-widest ml-2">Consult a Scholar</AlertTitle>
            <AlertDescription className="text-base font-medium ml-2 mt-2">
                While this page provides general guidelines, specific financial situations can vary. We always recommend consulting with a knowledgeable religious scholar for precise rulings on your personal wealth and Zakat calculation.
            </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
