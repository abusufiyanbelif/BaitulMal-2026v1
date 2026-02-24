
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function CampaignSettingsPage() {
  return (
    <Card className="animate-fade-in-zoom">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings /> Campaign Settings
        </CardTitle>
        <CardDescription>
          Configuration options for the Campaign module.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">This section is under development.</p>
      </CardContent>
    </Card>
  );
}
