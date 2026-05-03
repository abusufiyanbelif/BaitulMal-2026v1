'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowLeft, 
    Database, 
    Terminal, 
    ShieldAlert, 
    Info, 
    Zap, 
    HardDrive, 
    RefreshCcw, 
    Trash2, 
    ShieldCheck, 
    Cpu,
    Workflow,
    History,
    ChevronRight,
    Command
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SeedPage() {

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute top-40 -right-20 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <div className="space-y-1.5">
                <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9 mb-2">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
                </Button>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <Database className="h-5 w-5" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Maintenance Hub</h1>
                </div>
                <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Organization database orchestration, migration protocols, and system maintenance suite.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-primary/5 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest text-primary/60">
                    <Terminal className="h-3.5 w-3.5" />
                    CLI Authorized
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
          <Alert className="rounded-[32px] border border-primary/5 bg-white/40 backdrop-blur-md p-8 shadow-xl animate-fade-in-up">
              <div className="flex items-start gap-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="space-y-4">
                      <AlertTitle className="text-xl font-black text-primary tracking-tighter">Organization Credentials Required</AlertTitle>
                      <AlertDescription className="text-sm font-bold text-primary/60 leading-relaxed">
                          To execute these orchestration protocols, the system requires root service account authorization. Ensure the primary identity key is present in the server environment.
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/5">
                                  <p className="text-[10px] font-black tracking-widest opacity-40 mb-2">Protocol 1</p>
                                  <p className="text-xs font-bold leading-tight">Extract JSON key from Firebase Console &gt; Service Accounts.</p>
                              </div>
                              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/5">
                                  <p className="text-[10px] font-black tracking-widest opacity-40 mb-2">Protocol 2</p>
                                  <p className="text-xs font-bold leading-tight">Rename to <span className="font-mono text-primary">serviceAccountKey.json</span> in root directory.</p>
                              </div>
                          </div>
                      </AlertDescription>
                  </div>
              </div>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-[40px] border border-primary/5 bg-white/30 backdrop-blur-md p-8 space-y-6 animate-fade-in-up shadow-none hover:shadow-2xl transition-all duration-500" style={{ animationDelay: '100ms' }}>
                  <div className="flex items-center gap-4 border-b border-primary/5 pb-6">
                      <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                          <Zap className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5">
                          <h3 className="text-lg font-black text-primary tracking-tighter">Database Seeding</h3>
                          <p className="text-[10px] font-bold text-primary/40 tracking-widest">Initial Boot Protocol</p>
                      </div>
                  </div>
                  <p className="text-sm font-bold text-primary/60 leading-relaxed">Ensures the root administrator exists and repairs structural integrity for core settings. Use this to re-initialize a fresh environment.</p>
                  <div className="group relative">
                      <div className="p-5 bg-black/90 text-emerald-500 rounded-2xl font-mono text-sm flex items-center gap-3 shadow-2xl border border-white/5 overflow-hidden">
                          <div className="flex-1 flex items-center gap-3">
                              <span className="opacity-40 select-none">$</span>
                              <span className="font-bold tracking-tight group-hover:translate-x-1 transition-transform">npm run db:seed</span>
                          </div>
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                  </div>
              </Card>

              <Card className="rounded-[40px] border border-primary/5 bg-white/30 backdrop-blur-md p-8 space-y-6 animate-fade-in-up shadow-none hover:shadow-2xl transition-all duration-500" style={{ animationDelay: '200ms' }}>
                  <div className="flex items-center gap-4 border-b border-primary/5 pb-6">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                          <Workflow className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5">
                          <h3 className="text-lg font-black text-primary tracking-tighter">Migration Matrix</h3>
                          <p className="text-[10px] font-bold text-primary/40 tracking-widest">Schema Evolution</p>
                      </div>
                  </div>
                  <div className="space-y-4">
                      {[
                          { cmd: 'migrate-settings', desc: 'Syncs branding & payment folder schemas.' },
                          { cmd: 'migrate-donations', desc: 'Links legacy donations to the flexible hub.' },
                          { cmd: 'migrate-beneficiaries', desc: 'Consolidates multi-collection identity maps.' },
                      ].map((m, idx) => (
                          <div key={idx} className="space-y-2 group">
                              <div className="p-4 bg-primary/[0.03] hover:bg-primary/[0.05] rounded-xl font-mono text-[11px] flex items-center justify-between transition-colors border border-primary/5">
                                  <div className="flex items-center gap-3">
                                      <span className="opacity-30 select-none">$</span>
                                      <span className="font-bold text-primary">npm run db:{m.cmd}</span>
                                  </div>
                                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                              </div>
                              <p className="text-[10px] font-bold text-primary/40 pl-4">{m.desc}</p>
                          </div>
                      ))}
                  </div>
              </Card>
          </div>

          <Card className="rounded-[40px] border border-rose-500/10 bg-rose-500/[0.02] p-10 space-y-8 animate-fade-in-up shadow-none hover:shadow-2xl transition-all duration-500" style={{ animationDelay: '300ms' }}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border-b border-rose-500/10 pb-8">
                  <div className="flex items-center gap-6">
                      <div className="h-16 w-16 rounded-[24px] bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-500/30">
                          <ShieldAlert className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                          <h3 className="text-2xl font-black text-rose-900 tracking-tighter">Critical Erase Protocol</h3>
                          <p className="text-sm font-bold text-rose-800/40 tracking-widest">Data Purge & System Reset</p>
                      </div>
                  </div>
                  <Badge className="bg-rose-500 text-white font-black text-[10px] tracking-[0.2em] px-6 py-2 rounded-full border-4 border-white shadow-xl">High Risk</Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                      <p className="text-sm font-bold text-rose-900/60 leading-relaxed">This command initiates a total wipe of all organization operational data. Campaigns, Beneficiaries, Donations, and Non-Root Users will be permanently expunged along with their cloud artifacts.</p>
                      <div className="p-6 rounded-[24px] bg-rose-500/5 border border-rose-500/10 text-rose-900 font-bold text-xs italic leading-relaxed">
                          "Authorized purge is irreversible. All linked identifiers and storage vectors will be discarded from the cloud matrix."
                      </div>
                  </div>
                  <div className="flex flex-col justify-center gap-6">
                      <div className="group relative">
                          <div className="p-6 bg-rose-950 text-rose-500 rounded-[24px] font-mono text-sm flex items-center justify-between shadow-2xl border border-rose-500/20">
                              <div className="flex items-center gap-4">
                                  <span className="opacity-30 select-none">$</span>
                                  <span className="font-bold tracking-tight">npm run db:erase</span>
                              </div>
                              <Trash2 className="h-5 w-5 animate-pulse" />
                          </div>
                      </div>
                      <p className="text-[10px] font-black text-rose-900/40 tracking-widest text-center">Protocol Requires Manual Confirmation in CLI</p>
                  </div>
              </div>
          </Card>
      </div>
    </main>
  );
}
