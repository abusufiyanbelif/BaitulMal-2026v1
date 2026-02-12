'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { Mail, Phone, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  const { paymentSettings, isLoading } = usePaymentSettings();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <WifiOff className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle>You are currently offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Please check your internet connection and try again.
          </p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
          {!isLoading && (paymentSettings?.contactEmail || paymentSettings?.contactPhone) && (
             <div className="pt-4 text-sm text-muted-foreground border-t mt-4">
                <p className="font-semibold mb-2">Need help?</p>
                {paymentSettings.contactEmail && (
                    <div className="flex items-center justify-center gap-2">
                        <Mail className="h-4 w-4" />
                        <a href={`mailto:${paymentSettings.contactEmail}`}>{paymentSettings.contactEmail}</a>
                    </div>
                )}
                {paymentSettings.contactPhone && (
                     <div className="flex items-center justify-center gap-2 mt-1">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${paymentSettings.contactPhone}`}>{paymentSettings.contactPhone}</a>
                    </div>
                )}
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
