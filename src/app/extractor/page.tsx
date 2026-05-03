'use client';
import { 
    CreditCard, 
    FileText, 
    HeartPulse, 
    User, 
    ToyBrick, 
    BookUser, 
    ArrowLeft,
    Sparkles,
    ShieldCheck,
    Cpu,
    Fingerprint,
    Stethoscope,
    GraduationCap,
    Workflow
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

export default function ExtractorPage() {
  const { isLoading } = useSession();

  if (isLoading) {
    return <SectionLoader label="Syncing AI Neural Models..." description="Calibrating document vision and extraction parameters." />;
  }

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
      {/* Premium Background Elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -z-10" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <div className="space-y-1.5">
                <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9 mb-2">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
                </Button>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Intelligence Hub</h1>
                </div>
                <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Advanced AI document analysis and metadata extraction suite for organization vetting.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-primary/5 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Vetting Active
                </div>
                <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary/60">
                    <Cpu className="h-3.5 w-3.5" />
                    v4.0 Neural
                </div>
            </div>
        </div>

        <Tabs defaultValue="text" className="w-full animate-fade-in-up">
            <div className="bg-white/30 backdrop-blur-md p-2 rounded-[32px] border border-primary/5 shadow-none mb-10">
                <ScrollArea className="w-full">
                    <TabsList className="flex items-center justify-start gap-2 h-auto w-full bg-transparent p-0">
                        {[
                            { value: 'text', label: 'General OCR', icon: FileText, color: 'text-primary' },
                            { value: 'identity', label: 'Identity Auth', icon: Fingerprint, color: 'text-blue-500' },
                            { value: 'billing', label: 'Financials', icon: CreditCard, color: 'text-emerald-500' },
                            { value: 'medical', label: 'Clinical Data', icon: Stethoscope, color: 'text-rose-500' },
                            { value: 'education', label: 'Academic', icon: GraduationCap, color: 'text-indigo-500' },
                            { value: 'dynamic', label: 'Custom Logic', icon: Workflow, color: 'text-amber-500' },
                        ].map((tab) => (
                            <TabsTrigger 
                                key={tab.value}
                                value={tab.value} 
                                className="flex-1 min-w-[150px] h-14 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xl border border-transparent data-[state=active]:border-primary/5 transition-all duration-500 group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-xl bg-primary/5 transition-all group-data-[state=active]:bg-primary group-data-[state=active]:text-white", tab.color)}>
                                        <tab.icon className="h-4 w-4" />
                                    </div>
                                    <span className="font-black text-[10px] uppercase tracking-widest">{tab.label}</span>
                                </div>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>
            
            <div className="relative">
                <div className="absolute inset-0 bg-primary/[0.01] rounded-[48px] blur-3xl -z-10" />
                
                <TabsContent value="text" className="mt-0 ring-0 focus-visible:ring-0">
                    <div className="animate-fade-in-up"><TextExtractor /></div>
                </TabsContent>
                <TabsContent value="identity" className="mt-0 ring-0 focus-visible:ring-0">
                    <div className="animate-fade-in-up"><IdentityExtractor /></div>
                </TabsContent>
                <TabsContent value="billing" className="mt-0 ring-0 focus-visible:ring-0">
                    <div className="animate-fade-in-up"><BillingExtractor /></div>
                </TabsContent>
                <TabsContent value="medical" className="mt-0 ring-0 focus-visible:ring-0">
                    <div className="animate-fade-in-up"><MedicalExtractor /></div>
                </TabsContent>
                <TabsContent value="education" className="mt-0 ring-0 focus-visible:ring-0">
                    <div className="animate-fade-in-up"><EducationExtractor /></div>
                </TabsContent>
                <TabsContent value="dynamic" className="mt-0 ring-0 focus-visible:ring-0">
                    <div className="animate-fade-in-up"><DynamicExtractor /></div>
                </TabsContent>
            </div>
        </Tabs>
      </div>
    </main>
  );
}