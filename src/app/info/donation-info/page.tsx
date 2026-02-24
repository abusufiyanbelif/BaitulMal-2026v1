
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Check, X, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfoSettings } from '@/hooks/use-info-settings';
import { useDonationInfo } from '@/hooks/use-donation-info';

const comparisonData = [
    { feature: 'Status', zakat: 'Obligatory (Fard)', sadaqah: 'Voluntary', lillah: 'Voluntary', fidiya: 'Obligatory Compensation', interest: 'Mandatory disposal' },
    { feature: 'Amount', zakat: 'Fixed (2.5%)', sadaqah: 'Any amount', lillah: 'Any amount', fidiya: 'Fixed per missed fast', interest: 'Total amount earned' },
    { feature: 'Recipient', zakat: 'Specific 8 categories', sadaqah: 'Anyone in need', lillah: 'Institutions/Public', fidiya: 'Poor & Needy', interest: 'Public welfare' },
    { feature: 'Mosque/School', zakat: <X className="text-destructive" />, sadaqah: <Check className="text-success-foreground" />, lillah: 'Primary use', fidiya: <X className="text-destructive" />, interest: <Check className="text-success-foreground" /> },
];

export default function DonationInfoPage() {
    const { infoSettings, isLoading: isInfoLoading } = useInfoSettings();
    const { donationInfoData, isLoading: isContentLoading } = useDonationInfo();

    const isLoading = isInfoLoading || isContentLoading;
    const donationTypes = donationInfoData?.types || [];

    if (isLoading) {
        return (
             <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!infoSettings?.isDonationInfoPublic) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <h1 className="text-2xl font-bold">Page Not Available</h1>
                <p className="text-muted-foreground mt-2">This informational page is not currently public.</p>
                 <Button asChild className="mt-6">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back to Home
                    </Link>
                </Button>
            </main>
        );
    }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto animate-fade-in-zoom">
        <CardHeader>
          <CardTitle className="text-3xl">Understanding Donation Types in Islam</CardTitle>
          <CardDescription>
            In Islam, financial and charitable practices are categorized based on their obligation and purpose. Here is a breakdown of the differences between Zakat, Sadaqah, Fidiya, Lillah, and Interest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {donationTypes.map((type, index) => (
            <div key={type.id || index} className="space-y-2">
              <h2 className="text-2xl font-semibold text-primary">{type.title}</h2>
              <p className="text-muted-foreground">{type.description}</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Where it can be used:</strong> {type.usage}</li>
                {type.restrictions && <li><strong>Restrictions:</strong> {type.restrictions}</li>}
                {type.impact && <li><strong>Impact:</strong> {type.impact}</li>}
                {type.keyUse && <li><strong>Key Use:</strong> {type.keyUse}</li>}
                {type.application && <li><strong>Application:</strong> {type.application}</li>}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-2xl font-semibold text-primary mb-4">At a Glance</h2>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold w-[150px]">Feature</TableHead>
                    <TableHead className="font-bold">Zakat</TableHead>
                    <TableHead className="font-bold">Sadaqah</TableHead>
                    <TableHead className="font-bold">Lillah</TableHead>
                    <TableHead className="font-bold">Fidiya</TableHead>
                    <TableHead className="font-bold">Interest (Disposal)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      <TableCell>{row.zakat}</TableCell>
                      <TableCell>{row.sadaqah}</TableCell>
                      <TableCell>{row.lillah}</TableCell>
                      <TableCell>{row.fidiya}</TableCell>
                      <TableCell>{row.interest}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

        </CardContent>
      </Card>
    </main>
  );
}
