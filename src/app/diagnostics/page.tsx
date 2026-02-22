
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
                    return { status: 'failure', details: 'One or more Firebase services could not be initialized. Check your .env file and Firebase project settings.' };
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
                            The following environment variables are missing from your configuration: <strong>{missingVars.join(', ')}</strong>. Please check your `.env` file.
                        </span>
                    ) };
                }
            },
        },
        {
            id: 'firebase-auth',
            name: 'Firebase Authentication',
            description: 'Checks the current user authentication status.',
            icon: <KeyRound className="h-6 w-6 text-primary" />,
            run: async () => {
                await new Promise(res => setTimeout(res, 300));
                if (user) {
                    return { status: 'success', details: `Authenticated as ${user.email}.` };
                } else {
                    return { status: 'failure', details: 'No user is currently authenticated. Please log in to test authenticated routes.' };
                }
            },
        },
        {
            id: 'firestore-read',
            name: 'Firestore Connectivity',
            description: 'Attempts public reads from the "user_lookups" and "settings" collections.',
            icon: <DatabaseZap className="h-6 w-6 text-primary" />,
            run: async () => {
                if (!firestore) {
                    return { status: 'failure', details: 'Cannot perform Firestore test because the service is not initialized.' };
                }
                try {
                    // Test `get` on public-readable documents.
                    const lookupDocRef = doc(firestore, 'user_lookups', 'admin');
                    await getDoc(lookupDocRef);
                    
                    const settingsDocRef = doc(firestore, 'settings', 'branding');
                    await getDoc(settingsDocRef);
                    
                    return { status: 'success', details: 'Successfully connected and performed public reads from `user_lookups` and `settings`.' };
                } catch (error: any) {
                    return { status: 'failure', details: `Firestore public read failed. This could be a connectivity issue or a problem with your Security Rules. Error: ${error.message}` };
                }
            },
        },
        {
            id: 'admin-seed-check',
            name: 'Admin User Database Record',
            description: 'Verifies that the default admin user exists in the database.',
            icon: <Database className="h-6 w-6 text-primary" />,
            run: async () => {
                 if (!firestore) return { status: 'failure', details: 'Firestore is not initialized.' };
                 if (!userProfile) return { status: 'skipped', details: 'Cannot run test without a logged-in user profile.' };
                
                try {
                    const adminLookupSnap = await getDoc(doc(firestore, 'user_lookups', 'admin'));
                    if (!adminLookupSnap.exists()) {
                        return { status: 'failure', details: (
                            <span>
                                <strong>Admin user lookup record not found.</strong> This is required for login. Please run <strong>`npm run db:seed`</strong> from your terminal to create it.
                            </span>
                        )};
                    }

                    if (userProfile.role !== 'Admin') {
                        return { status: 'skipped', details: 'Admin lookup record found. Skipped user profile document verification because you are not an administrator.'};
                    }
                    
                    const adminUserDocSnap = await getDocs(query(collection(firestore, 'users'), where('userKey', '==', 'admin')));
                    if (adminUserDocSnap.empty) {
                         return { status: 'failure', details: (
                            <span>
                                <strong>Admin user profile document not found.</strong> This is required for the application to function correctly. Please run <strong>`npm run db:seed`</strong> from your terminal.
                            </span>
                        )};
                    }

                    return { status: 'success', details: 'Default admin user database records are correctly set up.' };
                } catch (error: any) {
                    return { status: 'failure', details: `Failed to verify admin records. This may indicate a problem with your Firestore Security Rules. Error: ${error.message}` };
                }
            }
        },
        {
            id: 'storage-connectivity',
            name: 'Storage Connectivity',
            description: 'Attempts to read metadata from a public file to verify read access.',
            icon: <FolderKanban className="h-6 w-6 text-primary" />,
            run: async () => {
                const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
                const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

                if (!storage || !storageBucket) {
                    return { status: 'failure', details: `Cannot perform Storage test without the Storage service or a configured Storage Bucket.` };
                }
                
                const publicFileRef = storageRef(storage, 'settings/logo');
                try {
                    await getMetadata(publicFileRef);
                    return { status: 'success', details: 'Successfully connected and verified read access to a public file in Firebase Storage.' };
                } catch (error: any) {
                    if (error.code === 'storage/object-not-found') {
                        return { status: 'success', details: (
                            <span>
                                <strong>Connectivity OK, file not found.</strong> The test successfully reached the storage bucket, but the test file (<strong>settings/logo</strong>) does not exist. This is expected if a logo has not been uploaded.
                            </span>
                        )};
                    } else if (error.code === 'storage/unauthorized') {
                        const storageRulesUrl = `https://console.firebase.google.com/project/${projectId}/storage/${storageBucket}/rules`;
                        return { status: 'failure', details: (
                            <div className="space-y-2">
                                <p><strong>Permission Denied.</strong> This is a Firebase Storage Security Rules issue.</p>
                                <p>The test could not read metadata from the public `/settings/logo` file. This is unexpected with the default rules.</p>
                                <p><strong>Solution:</strong> Go to the Storage Rules editor and ensure you have a rule allowing public reads for the `settings` path.</p>
                                <pre className="p-2 text-xs bg-muted rounded-md font-code">
        {`match /settings/{allPaths=**} {
          allow read: if true;
          allow write: if isSignedIn();
        }`}
                                </pre>
                                 <Button asChild variant="link" className="p-0 h-auto">
                                    <a href={storageRulesUrl} target="_blank" rel="noopener noreferrer">
                                        Open Storage Rules Editor <ExternalLink className="ml-1 h-3 w-3" />
                                    </a>
                                </Button>
                            </div>
                        )};
                    } else if (error.code === 'storage/bucket-not-found') {
                         return { status: 'failure', details: (
                            <span>
                                <strong>Bucket Not Found.</strong> The storage bucket <strong>{storageBucket}</strong> does not exist. Please verify the `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` value in your `.env` file.
                            </span>
                        )};
                    }
                    return { status: 'failure', details: `Storage connectivity test failed. Error: ${error.message} (Code: ${error.code})` };
                }
            },
        },
        {
            id: 'storage-write-delete',
            name: 'Storage Write & Delete',
            description: 'Uploads and deletes a temporary file to verify write permissions.',
            icon: <Database className="h-6 w-6 text-primary" />,
            run: async () => {
                if (!storage || !user) {
                    return { status: 'skipped', details: 'Storage service not available or user not logged in.' };
                }
                if (userProfile?.role !== 'Admin' && !getNestedValue(userProfile, 'permissions.diagnostics.read', false)) {
                    return { status: 'skipped', details: 'This test requires admin or diagnostics read permissions.' };
                }
        
                const testFileName = `test/${user.uid}/diagnostic-test-${Date.now()}.txt`;
                const testFileRef = storageRef(storage, testFileName);
                const testFile = new Blob(['This is a test file for diagnostics.'], { type: 'text/plain' });
        
                try {
                    // 1. Write Test
                    await uploadBytes(testFileRef, testFile);
        
                    // 2. Read Metadata to verify upload
                    await getMetadata(testFileRef);
        
                    // 3. Delete Test
                    await deleteObject(testFileRef);
        
                    return { status: 'success', details: 'Successfully uploaded and deleted a test file in the /test/ directory.' };
        
                } catch (error: any) {
                    let details = `Storage write/delete test failed. Error: ${error.message} (Code: ${error.code})`;
                    if (error.code === 'storage/unauthorized') {
                        details += ' This likely means the security rules for the /test/ path are incorrect or missing. Ensure an admin or user with diagnostic permissions can write and delete in this path.';
                    }
                    return { status: 'failure', details: details };
                }
            },
        },
        {
            id: 'genkit-ai',
            name: 'Genkit AI Connectivity',
            description: 'Pings the Gemini model via a Genkit server-side flow.',
            icon: <BrainCircuit className="h-6 w-6 text-primary" />,
            run: async () => {
                try {
                    const apiResponse = await fetch('/api/run-diagnostic-check', { method: 'POST' });
                    
                    if (!apiResponse.ok) {
                        const errorText = await apiResponse.text();
                        try {
                            const errorData = JSON.parse(errorText);
                            throw new Error(errorData.error || `Server responded with status ${apiResponse.status}`);
                        } catch (e) {
                             throw new Error(`Server responded with status ${apiResponse.status}: ${errorText}`);
                        }
                    }

                    const genkitResult = await apiResponse.json();

                    if (genkitResult.ok) {
                        return { status: 'success', details: genkitResult.message };
                    } else {
                        return { status: 'failure', details: (
                            <div className="space-y-2">
                                <p>{genkitResult.message}</p>
                                {genkitResult.message.includes('API key') && (
                                    <Alert variant="destructive">
                                        <AlertTitle>Action Required</AlertTitle>
                                        <AlertDescription>
                                            Please ensure you have a `GEMINI_API_KEY` environment variable set in a `.env` file in your project root.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {genkitResult.message.includes('permission denied') && (
                                    <Alert variant="destructive">
                                        <AlertTitle>Action Required</AlertTitle>
                                        <AlertDescription>
                                            The API request was denied. Go to your Google Cloud project and ensure the 'Generative Language API' is enabled.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )};
                    }
                } catch (error: any) {
                    return { status: 'failure', details: `The diagnostic check failed to run. Error: ${error.message}` };
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
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <Card className="max-w-4xl mx-auto animate-fade-in-zoom">
                <CardHeader>
                    <CardTitle>System Diagnostics</CardTitle>
                    <p className="text-muted-foreground">Run tests to check the connectivity and configuration of required application resources.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={runAllChecks} disabled={isAllRunning}>
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
                                <div key={check.id} className="flex items-start gap-4 p-4 border rounded-lg">
                                    <div className="mt-1">{check.icon}</div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold">{check.name}</h3>
                                                <p className="text-sm text-muted-foreground">{check.description}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {result && getStatusIcon(result.status)}
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => runSingleCheck(check)}
                                                    disabled={isAllRunning || isLoading}
                                                >
                                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Run Test
                                                </Button>
                                            </div>
                                        </div>
                                        {result && result.status !== 'pending' && result.status !== 'running' && (
                                            <div className="text-sm text-muted-foreground pt-2 border-t">
                                                <strong className="text-foreground">Result:</strong> {result.details}
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
