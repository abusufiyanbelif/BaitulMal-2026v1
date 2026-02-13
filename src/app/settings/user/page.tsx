
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function UserSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings /> User Settings
        </CardTitle>
        <CardDescription>
          Configuration options for the User module.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">This section is under development.</p>
      </CardContent>
    </Card>
  );
}
