
'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Database, Terminal, ShieldAlert, Info } from 'lucide-react';
import Link from 'next/link';

export default function SeedPage() {

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
          <CardTitle>Database Management via Command Line</CardTitle>
          <CardDescription>
              Use these `npm` scripts to seed or migrate your application's database from the terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">

          <Alert>
              <Database className="h-4 w-4" />
              <AlertTitle>One-Time Setup for Admin Scripts</AlertTitle>
              <AlertDescription>
                <p>To run these scripts, you first need to provide admin credentials.</p>
                <ol className="list-decimal list-inside space-y-2 mt-2 text-sm text-muted-foreground">
                    <li>Go to your Firebase Project Settings &gt; Service accounts.</li>
                    <li>Click **Generate new private key** to download your service account JSON file.</li>
                    <li>Rename the downloaded file to `serviceAccountKey.json` and place it in the root directory of your project.</li>
                </ol>
                <p className="mt-2">That's it! The application will automatically find and use this file.</p>
              </AlertDescription>
          </Alert>

          <div className="space-y-4">
              <h3 className="text-lg font-semibold">Seeding the Database</h3>
              <p className="text-sm text-muted-foreground">This command ensures the initial administrator account exists. If it doesn't, it creates the Auth user and all necessary database records. If the database records are missing, it repairs them.</p>
              <div className="p-4 bg-muted rounded-md font-mono text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4"/>
                  <span>npm run db:seed</span>
              </div>
          </div>
          
           <div className="space-y-4">
              <h3 className="text-lg font-semibold">Data Structure Migrations</h3>
              <p className="text-sm text-muted-foreground">Run these commands if you have older data that needs to be updated to the latest application format.</p>
              <div className="space-y-4">
                  <div className="space-y-2">
                      <div className="p-4 bg-muted rounded-md font-mono text-sm flex items-center gap-2">
                          <Terminal className="h-4 w-4"/>
                          <span>npm run db:migrate-settings</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-primary font-bold pl-2 uppercase tracking-tighter">
                          <Info className="h-3 w-3"/> Essential: Moves existing branding and payment files to the new folder structure.
                      </div>
                  </div>
                  <div className="space-y-2">
                      <div className="p-4 bg-muted rounded-md font-mono text-sm flex items-center gap-2">
                          <Terminal className="h-4 w-4"/>
                          <span>npm run db:migrate-donations</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-2">Updates old `campaignId` donations to the new flexible linking format.</p>
                  </div>
                   <div className="space-y-2">
                      <div className="p-4 bg-muted rounded-md font-mono text-sm flex items-center gap-2">
                          <Terminal className="h-4 w-4"/>
                          <span>npm run db:migrate-beneficiaries</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-2">Syncs any beneficiaries from Campaign/Lead subcollections to the master beneficiary list.</p>
                  </div>
              </div>
          </div>

           <div className="space-y-4">
              <h3 className="text-lg font-semibold">Erasing Application Data</h3>
              <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Warning: Destructive Action</AlertTitle>
                  <AlertDescription>
                      This command will permanently delete all campaigns, beneficiaries, donations, and non-admin users from your database. It will also erase all corresponding files from Firebase Storage. This action is irreversible.
                  </AlertDescription>
              </Alert>
               <p className="text-sm text-muted-foreground pt-2">Run this command to reset your application's data. After running, you may need to run `npm run db:seed` again to restore the admin's database records.</p>
              <div className="p-4 bg-muted rounded-md font-mono text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4"/>
                  <span>npm run db:erase</span>
              </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
