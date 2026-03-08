'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Quote, Target, Loader2, CheckCircle2, XCircle, BookOpen, ListChecks, AlertCircle, Info, Heart, Utensils, Building2, Ban } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfoSettings } from '@/hooks/use-info-settings';
import { useDonationInfo } from '@/hooks/use-donation-info';
import { defaultDonationInfo } from '@/lib/donation-info-default';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Custom Zakat Icon - Engineered to match the institutional 2.5% requirement visual.
 */
const ZakatCustomIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 512 512" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <rect x="40" y="390" width="80" height="90" rx="8" fill="hsl(var(--primary))" stroke="black" strokeWidth="18" />
    <path 
      d="M120 435H380C430 435 480 410 480 360C480 330 450 310 410 310H320V320C320 340 300 360 280 360H120V435Z" 
      fill="#FFE0B2" 
      stroke="black" 
      strokeWidth="18" 
      strokeLinejoin="round" 
    />
    <path 
      d="M180 310C180 180 210 100 260 100C310 100 340 180 340 310H180Z" 
      fill="#F5F5F5" 
      stroke="black" 
      strokeWidth="18" 
      strokeLinejoin="round"
    />
    <path 
      d="M230 100L215 50C215 40 225 30 235 30H285C295 30 305 40 305 50L290 100H230Z" 
      fill="#F5F5F5" 
      stroke="black" 
      strokeWidth="18" 
      strokeLinejoin="round"
    />
    <rect x="215" y="90" width="90" height="25" rx="12.5" fill="hsl(var(--primary))" stroke="black" strokeWidth="18" />
    <circle cx="260" cy="225" r="60" fill="hsl(var(--primary))" stroke="black" strokeWidth="18" />
    <text 
      x="260" 
      y="225" 
      textAnchor="middle" 
      dominantBaseline="central" 
      fill="white" 
      style={{ fontSize: '54px', fontWeight: '900', fontFamily: 'sans-serif' }}
    >
      2.5
    </text>
  </svg>
);

const typeIcons: Record<string, any> = {
    zakat: ZakatCustomIcon,
    sadaqah: Heart,
    fidiya: Utensils,
    lillah: Building2,
    interest: Ban,
};

const comparisonData = [
    { feature: 'Status', zakat: 'Obligatory (Fard)', sadaqah: 'Voluntary', lillah: 'Voluntary', fidiya: 'Obligatory Compensation', interest: 'Mandatory Disposal' },
    { feature: 'Amount', zakat: 'Fixed (2.5%)', sadaqah: 'Any Amount', lillah: 'Any Amount', fidiya: 'Fixed Per Missed Fast', interest: 'Total Amount Earned' },
    { feature: 'Recipient', zakat: 'Specific 8 Categories', sadaqah: 'Anyone In Need', lillah: 'Institutions/Public', fidiya: 'Poor & Needy', interest: 'Public Welfare' },
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
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <h1 className="text-2xl font-bold text-primary">Page Not Available</h1>
                <p className="text-muted-foreground mt-2">This Informational Page Is Not Currently Public.</p>
                 <Button asChild className="mt-6 font-bold" variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back To Home
                    </Link>
                </Button>
            </main>
        );
    }

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-12 text-primary font-normal">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 transition-transform active:scale-95">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back To Home
          </Link>
        </Button>
      </div>

      <section className="text-center space-y-4 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-primary">Financial Wisdom In Islam</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-normal leading-relaxed">
              Understanding The Distinct Categories Of Charitable Giving Ensures Your Contributions Are Used Correctly And Fulfill Their Intended Religious Purposes.
          </p>
      </section>

      <Tabs defaultValue={donationTypes[0]?.id} className="max-w-5xl mx-auto">
        <div className="flex justify-center mb-8">
            <ScrollArea className="w-full sm:w-auto">
                <TabsList className="bg-muted/50 p-1">
                    {donationTypes.map((type) => (
                        <TabsTrigger key={type.id} value={type.id} className="px-6 py-2 font-bold tracking-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            {type.title?.split(' ')[0] || type.id}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        {donationTypes.map((type) => {
            const IconComponent = typeIcons[type.id] || Info;
            const displayImageUrl = type.imageUrl ? (type.imageUrl.startsWith('data:') ? type.imageUrl : `/api/image-proxy?url=${encodeURIComponent(type.imageUrl)}`) : null;
            
            const visibleUseCases = type.useCases?.filter(uc => !uc.isHidden && (uc.title?.trim() || uc.description?.trim())) || [];
            const visibleQA = type.qaItems?.filter(qa => !qa.isHidden && (qa.question?.trim() || qa.answer?.trim())) || [];

            return (
                <TabsContent key={type.id} value={type.id} className="animate-fade-in-up">
                    <Card className="overflow-hidden border-primary/10 shadow-xl bg-white">
                        <div className="relative h-64 md:h-80 w-full flex items-center justify-center bg-primary/5">
                            {displayImageUrl ? (
                                <Image src={displayImageUrl} alt={type.title || 'Header'} fill className="object-cover" priority />
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-6 rounded-full bg-primary/10 text-primary">
                                        <IconComponent className="h-32 w-32" />
                                    </div>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <div className="absolute bottom-8 left-8 text-white pr-8">
                                <h2 className="text-3xl font-bold tracking-tight drop-shadow-md">{type.title}</h2>
                            </div>
                        </div>
                        <CardContent className="p-8 md:p-12 space-y-10">
                            <div className="grid md:grid-cols-3 gap-10">
                                <div className="md:col-span-2 space-y-8">
                                    <div className="space-y-4 font-normal">
                                        {type.description && <p className="text-lg leading-relaxed text-foreground whitespace-pre-wrap font-normal">{type.description}</p>}
                                        
                                        {type.quranVerse && (
                                            <blockquote className="border-l-4 border-primary/30 pl-6 py-4 italic text-muted-foreground relative bg-primary/[0.02] rounded-r-xl">
                                                <Quote className="h-6 w-6 text-primary/10 absolute -top-3 -left-3" />
                                                <p className="text-lg leading-relaxed font-normal">"{type.quranVerse}"</p>
                                                {type.quranSource && (
                                                    <cite className="block text-right not-italic text-sm font-bold text-primary mt-4 tracking-tight">
                                                        — {type.quranSource}
                                                    </cite>
                                                )}
                                            </blockquote>
                                        )}
                                    </div>

                                    {!type.hideUseCases && visibleUseCases.length > 0 && (
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-bold tracking-tight text-primary flex items-center gap-3">
                                                <Target className="h-5 w-5" /> {type.useCasesHeading || "Practical Scenarios & Methodology"}
                                            </h3>
                                            <div className="grid gap-4">
                                                {visibleUseCases.map((useCase) => (
                                                    <div key={useCase.id} className="group p-6 rounded-xl border border-primary/10 bg-white hover:border-primary/30 transition-all">
                                                        <div className="flex items-start gap-4">
                                                            <div className="mt-1 shrink-0">
                                                                {useCase.isAllowed ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                                                            </div>
                                                            <div className="space-y-2 flex-1">
                                                                {useCase.title && <h4 className="font-bold text-base text-primary">{useCase.title}</h4>}
                                                                <p className="text-muted-foreground font-normal text-sm leading-relaxed">{useCase.description}</p>
                                                                
                                                                {(useCase.quranVerse || useCase.quranSource) && (
                                                                    <div className="mt-4 p-4 bg-muted/20 rounded-lg border-l-2 border-primary/20 italic text-xs text-muted-foreground">
                                                                        {useCase.quranVerse && <p>"{useCase.quranVerse}"</p>}
                                                                        {useCase.quranSource && <p className="text-[10px] font-bold text-primary text-right mt-2">— {useCase.quranSource}</p>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-8 font-normal">
                                    {!type.hideKeyHighlights && type.purposePoints && type.purposePoints.length > 0 && (
                                        <div className="bg-primary/[0.02] p-6 rounded-2xl border border-primary/10">
                                            <h4 className="font-bold text-xs uppercase tracking-widest text-primary/60 mb-4 flex items-center gap-2">
                                                <ListChecks className="h-4 w-4" /> Key Highlights
                                            </h4>
                                            <ul className="space-y-3">
                                                {type.purposePoints.map((point, pIdx) => (
                                                    <li key={pIdx} className="flex items-start gap-3 text-sm">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                                        <span className="whitespace-pre-wrap font-normal leading-relaxed">{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {!type.hideUsage && type.usage && (
                                            <div className="p-4 rounded-xl bg-muted/30 border border-primary/5">
                                                <span className="font-bold text-[10px] tracking-tight text-primary/40 block mb-2">Permissible Usage</span>
                                                <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap">{type.usage}</p>
                                            </div>
                                        )}
                                        {!type.hideRestrictions && type.restrictions && (
                                            <div className="p-4 rounded-xl bg-red-50/30 border border-red-100">
                                                <span className="font-bold text-[10px] tracking-tight text-red-400 block mb-2">Strict Restrictions</span>
                                                <p className="text-sm font-normal leading-relaxed text-red-900/70 whitespace-pre-wrap">{type.restrictions}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {!type.hideQA && visibleQA.length > 0 && (
                                <div className="space-y-8 pt-10 border-t border-primary/10 font-normal">
                                    <h3 className="text-xl font-bold tracking-tight text-primary flex items-center gap-3">
                                        <BookOpen className="h-5 w-5" /> Common Questions
                                    </h3>
                                    <div className="grid sm:grid-cols-2 gap-6">
                                        {visibleQA.map((qa) => (
                                            <div key={qa.id} className="space-y-4 bg-muted/10 p-6 rounded-2xl border border-primary/5">
                                                <div className="space-y-2">
                                                    <h4 className="font-bold text-base text-primary">Q: {qa.question}</h4>
                                                    <p className="text-sm text-foreground/80 leading-relaxed font-normal">A: {qa.answer}</p>
                                                </div>
                                                
                                                {(qa.quranVerse || qa.quranSource) && (
                                                    <div className="p-3 bg-white/50 rounded-lg border-l-2 border-primary/20 italic text-xs text-muted-foreground">
                                                        {qa.quranVerse && <p>"{qa.quranVerse}"</p>}
                                                        {qa.quranSource && <p className="text-[10px] font-bold text-primary text-right mt-1">— {qa.quranSource}</p>}
                                                    </div>
                                                )}
                                                
                                                {qa.reference && (
                                                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tight pt-2 flex items-center gap-1">
                                                        <Info className="h-3 w-3" /> Reference: {qa.reference}
                                                    </p>
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
              <h2 className="text-2xl font-bold tracking-tight text-primary">Quick Comparison</h2>
              <p className="text-muted-foreground font-normal">Identifying The Primary Differences At A Glance.</p>
          </div>
          <Card className="shadow-xl overflow-hidden border-primary/10 bg-white">
              <Table>
                  <TableHeader className="bg-primary/5">
                  <TableRow>
                      <TableHead className="font-bold text-[10px] tracking-tight w-[150px]">Feature</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-tight">Zakat</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-tight">Sadaqah</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-tight">Lillah</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-tight">Fidiya</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {comparisonData.map((row) => (
                      <TableRow key={row.feature} className="hover:bg-primary/[0.02] transition-colors">
                      <TableCell className="font-bold text-xs bg-primary/[0.01] tracking-tight text-primary/60">{row.feature}</TableCell>
                      <TableCell className="text-xs font-normal">{row.zakat}</TableCell>
                      <TableCell className="text-xs font-normal">{row.sadaqah}</TableCell>
                      <TableCell className="text-xs font-normal">{row.lillah}</TableCell>
                      <TableCell className="text-xs font-normal">{row.fidiya}</TableCell>
                      </TableRow>
                  ))}
                  </TableBody>
              </Table>
          </Card>
      </section>

      <div className="max-w-5xl mx-auto font-normal">
        <Alert className="bg-primary/5 border-primary/20 p-6 rounded-2xl shadow-sm">
            <AlertCircle className="h-6 w-6 text-primary" />
            <AlertTitle className="font-bold text-sm tracking-tight ml-2">Consult A Scholar</AlertTitle>
            <AlertDescription className="text-base font-normal ml-2 mt-2 leading-relaxed">
                While This Page Provides General Guidelines, Specific Financial Situations Can Vary. We Always Recommend Consulting With A Knowledgeable Religious Scholar For Precise Rulings On Your Personal Wealth And Zakat Calculation.
            </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
