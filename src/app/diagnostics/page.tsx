'use client';
import { useState, useCallback, useMemo } from 'react';
import { useAuth, useStorage, useFirestore } from '@/firebase/provider';
import { useSession } from '@/hooks/use-session';
import { collection, query, limit, getDocs, doc, where, getDoc } from 'firebase/firestore';
import { ref as storageRef, getMetadata, uploadBytes, deleteObject } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, PlayCircle, ExternalLink, BrainCircuit, Database, FileCog, KeyRound, DatabaseZap, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getNestedValue } from '@/lib/utils';

type TestResult = 'success' | 'failure' | 'pending' | 'skipped';
type TestStatus = TestResult | 'running';

interface DiagnosticCheck {
    id: string;
    name: string;
    description: string;
    run: () => Promise<{ status: TestResult; details: React.ReactNode; }>;
    icon: React.ReactNode;
}

interface CheckResult {
    status: TestStatus;
    details: React.ReactNode;
}

export default function DiagnosticsPage() {
    const firestore = useFirestore();
    const auth = useAuth();
    const storage = useStorage();
    const { user, userProfile } = useSession();
    
    const [checkResults, setCheckResults] = useState<Record<string, CheckResult>>({});
    const [isAllRunning, setIsAllRunning] = useState(false);
    
    const diagnosticChecks: DiagnosticCheck[] = useMemo(() => [
        {
            id: 'firebase-init',
            name: 'Firebase Initialization',
            description: 'Checks if core Firebase services are initialized.',
            icon: <img src="https://www.gstatic.com/mobilesdk/160503_mobilesdk/logo/2x/firebase_28.png" alt="Firebase" className="h-6 w-6" />,
            run: async () => {
                await new Promise(res => setTimeout(res, 300));
                if (firestore && auth && storage) {
                    return { status: 'success', details: 'Firebase services (Firestore, Auth, Storage) are available.' };
                } else {
                    return { status: 'failure', details: 'One or more Firebase services could not be initialized. Check your environment configuration.' };
                }
            },
        },
        {
            id: 'firebase-config',
            name: 'Firebase Configuration',
            description: 'Verifies essential configuration values in your environment.',
            icon: <FileCog className="h-6 w-6 text-primary" />,
            run: async () => {
                await new Promise(res => setTimeout(res, 300));
                const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
                const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

                if (projectId && storageBucket) {
                     return { status: 'success', details: `Project ID and Storage Bucket are present in the configuration.` };
                } else {
                    let missingVars = [];
                    if (!projectId) missingVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
                    if (!storageBucket) missingVars.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
                    return { status: 'failure', details: (
                        <span>
                            Missing configuration: <strong>{missingVars.join(', ')}</strong>.
                        </span>
                    ) };
                }
            },
        },
        {
            id: 'firebase-auth',
            name: 'Authentication Status',
            description: 'Checks the current user authentication status.',
            icon: <KeyRound className="h-6 w-6 text-primary" />,
            run: async () => {
                await new Promise(res => setTimeout(res, 300));
                if (user) {
                    return { status: 'success', details: `Authenticated as ${user.email}.` };
                } else {
                    return { status: 'failure', details: 'No user is currently authenticated.' };
                }
            },
        },
        {
            id: 'firestore-read',
            name: 'Database Connectivity',
            description: 'Attempts public reads from necessary collections.',
            icon: <DatabaseZap className="h-6 w-6 text-primary" />,
            run: async () => {
                if (!firestore) {
                    return { status: 'failure', details: 'Database service is not initialized.' };
                }
                try {
                    const lookupDocRef = doc(firestore, 'user_lookups', 'admin');
                    await getDoc(lookupDocRef);
                    
                    const settingsDocRef = doc(firestore, 'settings', 'branding');
                    await getDoc(settingsDocRef);
                    
                    return { status: 'success', details: 'Successfully connected and performed necessary reads.' };
                } catch (error: any) {
                    return { status: 'failure', details: `Database read failed. Error: ${error.message}` };
                }
            },
        },
        {
            id: 'storage-connectivity',
            name: 'File Storage Connectivity',
            description: 'Attempts to read metadata from a public file.',
            icon: <FolderKanban className="h-6 w-6 text-primary" />,
            run: async () => {
                const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

                if (!storage || !storageBucket) {
                    return { status: 'failure', details: `Storage service or bucket not configured.` };
                }
                
                const publicFileRef = storageRef(storage, 'settings/logo');
                try {
                    await getMetadata(publicFileRef);
                    return { status: 'success', details: 'Successfully connected and verified read access.' };
                } catch (error: any) {
                    if (error.code === 'storage/object-not-found') {
                        return { status: 'success', details: 'Connectivity OK, test file not found (this is normal).' };
                    }
                    return { status: 'failure', details: `Storage test failed. Error: ${error.message}` };
                }
            },
        },
        {
            id: 'genkit-ai',
            name: 'AI Service Connectivity',
            description: 'Pings the AI model via a server-side flow.',
            icon: <BrainCircuit className="h-6 w-6 text-primary" />,
            run: async () => {
                try {
                    const apiResponse = await fetch('/api/run-diagnostic-check', { method: 'POST' });
                    const genkitResult = await apiResponse.json();

                    if (genkitResult.ok) {
                        return { status: 'success', details: genkitResult.message };
                    } else {
                        return { status: 'failure', details: genkitResult.message };
                    }
                } catch (error: any) {
                    return { status: 'failure', details: `The AI check failed. Error: ${error.message}` };
                }
            },
        }
    ], [firestore, auth, storage, user, userProfile]);

    const runSingleCheck = useCallback(async (check: DiagnosticCheck) => {
        setCheckResults(prev => ({
            ...prev,
            [check.id]: { status: 'running', details: 'Running test...' }
        }));
        
        const result = await check.run();

        setCheckResults(prev => ({
            ...prev,
            [check.id]: { status: result.status, details: result.details }
        }));
    }, []);

    const runAllChecks = async () => {
        setIsAllRunning(true);
        const initialResults: Record<string, CheckResult> = {};
        diagnosticChecks.forEach(check => {
            initialResults[check.id] = { status: 'pending', details: 'Waiting to run...' };
        });
        setCheckResults(initialResults);

        for (const check of diagnosticChecks) {
            await runSingleCheck(check);
        }
        setIsAllRunning(false);
    };

    const getStatusIcon = (status: TestStatus) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'failure':
                return <XCircle className="h-5 w-5 text-destructive" />;
            case 'skipped':
                return <CheckCircle2 className="h-5 w-5 text-yellow-500" />;
            case 'running':
                return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
            case 'pending':
            default:
                return null;
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Dashboard
                    </Link>
                </Button>
            </div>
            <Card className="max-w-4xl mx-auto animate-fade-in-zoom border-primary/10">
                <CardHeader>
                    <CardTitle className="font-bold text-primary">System Diagnostics</CardTitle>
                    <p className="text-muted-foreground font-normal">Run tests to check the connectivity and configuration of required resources.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={runAllChecks} disabled={isAllRunning} className="font-bold">
                        {isAllRunning ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        Run All Tests
                    </Button>
                    
                    <div className="space-y-4">
                        {diagnosticChecks.map((check) => {
                            const result = checkResults[check.id];
                            const isLoading = result?.status === 'running';
                            return (
                                <div key={check.id} className="flex items-start gap-4 p-4 border rounded-lg bg-white shadow-sm transition-all hover:border-primary/20">
                                    <div className="mt-1">{check.icon}</div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-primary">{check.name}</h3>
                                                <p className="text-sm text-muted-foreground font-normal">{check.description}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {result && getStatusIcon(result.status)}
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => runSingleCheck(check)}
                                                    disabled={isAllRunning || isLoading}
                                                    className="font-bold border-primary/10 text-primary"
                                                >
                                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Run Test
                                                </Button>
                                            </div>
                                        </div>
                                        {result && result.status !== 'pending' && result.status !== 'running' && (
                                            <div className="text-sm text-muted-foreground pt-2 border-t font-normal">
                                                <strong className="text-primary font-bold">Result:</strong> {result.details}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
