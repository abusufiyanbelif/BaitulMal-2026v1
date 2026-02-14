
'use client';
import { ReactNode } from 'react';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';


export function FirebaseContentWrapper({ children }: { children: ReactNode }) {
  const { userError } = useFirebase();

  if (userError) {
    const isFirestoreError = userError.message.includes("firestore");
    const isSsrError = userError.message.includes("blocked on server");
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const firestoreConsoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore`;
    const firestoreApiConsoleUrl = `https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${projectId}`;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-destructive">Firebase Initialization Failed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTitle>Error Details</AlertTitle>
                        <AlertDescription>
                            <div className="space-y-4">
                                {isSsrError && <p><strong>Runtime Error:</strong> Firebase Web SDK was incorrectly called on the server. This indicates a developer error that needs to be fixed in the code. Ensure all components using Firebase have `'use client'`;</p>}
                                {isFirestoreError && (
                                    <div className="space-y-2 p-3 bg-destructive/10 rounded-md">
                                        <p className="font-semibold">Firestore Not Available</p>
                                        <p className="text-xs">Your project is missing a Firestore database. Go to the Firebase console to create one, or enable the Firestore API if a database already exists.</p>
                                        <div className="flex gap-2 pt-1">
                                            <Button asChild className="flex-1" size="sm" variant="secondary">
                                                <a href={firestoreConsoleUrl} target="_blank" rel="noopener noreferrer">Create Database <ExternalLink className="ml-2 h-3 w-3"/></a>
                                            </Button>
                                            <Button asChild className="flex-1" size="sm" variant="secondary">
                                                <a href={firestoreApiConsoleUrl} target="_blank" rel="noopener noreferrer">Enable API <ExternalLink className="ml-2 h-3 w-3"/></a>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {!isSsrError && !isFirestoreError && (
                                    <p className="font-mono text-xs bg-destructive/20 p-2 rounded">
                                        {userError.message}
                                    </p>
                                )}
                            </div>
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => window.location.reload()} className="w-full">
                        Reload Page
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }
  return <>{children}</>;
}
