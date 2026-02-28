
'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Quote, Target, Info as InfoIcon, HelpCircle, CheckCircle2, Loader2 } from 'lucide-react';
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
import placeholderData from '@/app/lib/placeholder-images.json';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const comparisonData = [
    { feature: 'Status', zakat: 'Obligatory (Fard)', sadaqah: 'Voluntary', lillah: 'Voluntary', fidiya: 'Obligatory Compensation', interest: 'Mandatory disposal' },
    { feature: 'Amount', zakat: 'Fixed (2.5%)', sadaqah: 'Any amount', lillah: 'Any amount', fidiya: 'Fixed per missed fast', interest: 'Total amount earned' },
    { feature: 'Recipient', zakat: 'Specific 8 categories', sadaqah: 'Anyone in need', lillah: 'Institutions/Public', fidiya: 'Poor & Needy', interest: 'Public welfare' },
];

export default function DonationInfoPage() {
    const { infoSettings, isLoading: isInfoLoading } = useInfoSettings();
    const { donationInfoData, isLoading: isContentLoading } = useDonationInfo();

    const isLoading = isInfoLoading || isContentLoading;
    const donationTypes = donationInfoData?.types || [];

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
    <main className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="mb-4">
        <Button variant="outline" asChild className="active:scale-95 transition-transform">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <div className="max-w-5xl mx-auto space-y-12">
        <section className="text-center space-y-4 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-primary uppercase">Financial Wisdom in Islam</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Understanding the distinct categories of charitable giving ensures your contributions are used correctly and fulfill their intended religious and social purposes.
            </p>
        </section>

        <div className="grid gap-12">
          {donationTypes.map((type, index) => {
            const imageSeed = type.imageHint || type.id;
            const displayImageUrl = `https://picsum.photos/seed/${imageSeed}/800/600`;

            return (
                <Card key={type.id || index} className="overflow-hidden border-none shadow-xl animate-fade-in-up" style={{ animationDelay: `${index * 150}ms` }}>
                    <div className="grid md:grid-cols-2">
                        <div className={cn("relative h-64 md:h-auto min-h-[300px]", index % 2 === 1 ? "md:order-last" : "")}>
                            <Image 
                                src={displayImageUrl}
                                alt={type.title}
                                fill
                                className="object-cover"
                                data-ai-hint={type.imageHint || "charity image"}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-6 left-6 text-white">
                                <h2 className="text-3xl font-black tracking-tight">{type.title}</h2>
                            </div>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-4">
                                <p className="text-lg leading-relaxed text-foreground font-medium">{type.description}</p>
                                
                                {type.quranVerse && (
                                    <blockquote className="border-l-4 border-primary pl-4 py-2 italic text-muted-foreground relative bg-muted/30 rounded-r-lg">
                                        <Quote className="h-4 w-4 text-primary/40 absolute -top-2 -left-2" />
                                        "{type.quranVerse}"
                                        {type.quranSource && (
                                            <cite className="block text-right not-italic text-xs font-bold text-primary mt-2">
                                                — {type.quranSource}
                                            </cite>
                                        )}
                                    </blockquote>
                                )}

                                {type.purposePoints && type.purposePoints.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="font-bold flex items-center gap-2 text-primary uppercase text-xs tracking-widest">
                                            <Target className="h-4 w-4" /> 
                                            Key Objectives:
                                        </h4>
                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {type.purposePoints.map((point, pIdx) => (
                                                <li key={pIdx} className="flex items-center gap-2 text-sm">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                                    {point}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {type.useCases && type.useCases.length > 0 && (
                                    <div className="space-y-3 pt-2">
                                        <h4 className="font-bold flex items-center gap-2 text-blue-600 uppercase text-xs tracking-widest">
                                            <HelpCircle className="h-4 w-4" /> 
                                            Practical Use Cases:
                                        </h4>
                                        <ul className="space-y-2">
                                            {type.useCases.map((useCase, uIdx) => (
                                                <li key={uIdx} className="flex items-start gap-2 text-sm bg-blue-50/50 p-2 rounded-md border border-blue-100">
                                                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                                    <span className="text-slate-700">{useCase}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 gap-4 text-sm">
                                <div>
                                    <span className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground block mb-1">Permissible Usage:</span>
                                    <p className="text-foreground/80">{type.usage}</p>
                                </div>
                                {type.restrictions && (
                                    <div>
                                        <span className="font-bold uppercase text-[10px] tracking-widest text-destructive block mb-1">Restrictions:</span>
                                        <p className="text-foreground/80">{type.restrictions}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </div>
                </Card>
            )
          })}
        </div>

        <section className="space-y-6 animate-fade-in-up" style={{ animationDelay: '1s' }}>
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black tracking-tight uppercase">Quick Comparison</h2>
                <p className="text-muted-foreground">Identifying the primary differences at a glance.</p>
            </div>
            <Card className="shadow-lg overflow-hidden border-primary/10">
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
                        <TableCell className="font-bold text-xs bg-muted/20">{row.feature}</TableCell>
                        <TableCell className="text-xs">{row.zakat}</TableCell>
                        <TableCell className="text-xs">{row.sadaqah}</TableCell>
                        <TableCell className="text-xs">{row.lillah}</TableCell>
                        <TableCell className="text-xs">{row.fidiya}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </Card>
        </section>

        <Alert className="bg-primary/5 border-primary/20">
            <InfoIcon className="h-4 w-4 text-primary" />
            <AlertTitle className="font-bold">Consult a Scholar</AlertTitle>
            <AlertDescription className="text-sm">
                While this page provides a general guideline, specific financial situations can vary. We always recommend consulting with a knowledgeable religious scholar for precise rulings on your personal wealth and Zakat calculation.
            </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
