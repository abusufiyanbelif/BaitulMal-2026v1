'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { runPhoneMigrationAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function MigrationPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const { toast } = useToast();

    const handleMigration = async () => {
        if (!confirm("This will standardize ALL phone numbers to 10 digits across the registry. Proceed?")) return;
        
        setIsLoading(true);
        setResult(null);
        try {
            const res = await runPhoneMigrationAction();
            if (res.success) {
                setResult(res.message);
                toast({ title: "Migration Successful", description: res.message, variant: "success" });
            } else {
                toast({ title: "Migration Failed", description: res.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="container mx-auto p-8 max-w-2xl">
            <Card className="border-none shadow-2xl shadow-slate-200/50">
                <CardHeader className="space-y-1">
                    <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-2">
                        <Database className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900">Data Standardization Tool</CardTitle>
                    <CardDescription className="text-slate-500 font-medium">
                        Migrate existing phone numbers to the new 10-digit standard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-900 tracking-wider">Critical Operation</p>
                            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                This tool will scan `users`, `donors`, `beneficiaries`, and `user_lookups`. 
                                It will strip country codes (like +91) and extra digits, keeping only the last 10 digits.
                                This is required to fix login issues for users with inconsistent phone formats.
                            </p>
                        </div>
                    </div>

                    {result ? (
                        <div className="p-4 rounded-2xl bg-green-50 border border-green-100 flex items-center gap-3 animate-fade-in">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <p className="text-xs font-bold text-green-800">{result}</p>
                        </div>
                    ) : (
                        <Button 
                            onClick={handleMigration} 
                            disabled={isLoading}
                            className="w-full h-14 font-black tracking-widest rounded-2xl shadow-xl shadow-primary/20"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Run Phone Migration"}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
