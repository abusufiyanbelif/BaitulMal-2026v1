
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

const donationTypes = [
    {
        title: "Zakat (Obligatory Charity)",
        description: "Zakat is one of the Five Pillars of Islam. It is a mandatory annual payment of 2.5% of a Muslim's qualifying wealth (savings, gold, silver, business assets) if it exceeds a certain threshold called Nisab.",
        usage: "Its use is strictly restricted to eight categories of people defined in the Quran (9:60), including the poor, the needy, those in debt, and stranded travellers.",
        restrictions: "It cannot be used for infrastructure (like building mosques or schools) or given to immediate family members (parents, children).",
    },
    {
        title: "Sadaqah (Voluntary Charity)",
        description: "Sadaqah is a broad term for voluntary charity given purely for the sake of Allah. Unlike Zakat, it has no fixed amount or required timing. It can even include non-monetary acts like smiling or removing a harmful object from a path.",
        usage: "It has no restrictions on recipients and can be given to anyone in need, regardless of faith.",
        impact: "It is often used for immediate relief like food, clothing, and medical care.",
    },
    {
        title: "Fidiya (Compensation)",
        description: "Fidiya is a religious donation made in Islam when someone is unable to fast during Ramadan due to illness, old age, or other valid reasons. It is intended to feed a needy person for each day of fasting that is missed.",
        usage: "The money is used to provide meals to the poor and needy. Typically, it covers two meals for one person for each missed fast.",
        keyUse: "It serves as a compensation for missed fasts and is a separate obligation from Zakat.",
    },
    {
        title: "Lillah (For the Sake of Allah)",
        description: "Lillah is a type of voluntary Sadaqah. While \"Sadaqah\" often refers to helping individuals, \"Lillah\" is typically used to denote donations intended for institutions.",
        usage: "It is primarily used for the construction and maintenance of mosques, schools (Madrasas), hospitals, and other community infrastructure.",
        keyUse: "Unlike Zakat, Lillah can be used to cover the running costs (utilities, staff salaries) of Islamic institutions.",
    },
    {
        title: "Interest (Riba/Bank Interest)",
        description: "In Islam, taking or giving interest is forbidden (Haram). If interest is accumulated in a bank account, it must be disposed of to avoid utilizing it for personal benefit.",
        usage: "It must be given away to charity without the intention of reward.",
        application: "It is commonly used for public utility projects that do not have a direct spiritual component, such as building public toilets, repairing roads, or providing generic relief to the poor.",
    }
];

const comparisonData = [
    { feature: 'Status', zakat: 'Obligatory (Fard)', sadaqah: 'Voluntary', lillah: 'Voluntary', fidiya: 'Obligatory Compensation', interest: 'Mandatory disposal' },
    { feature: 'Amount', zakat: 'Fixed (2.5%)', sadaqah: 'Any amount', lillah: 'Any amount', fidiya: 'Fixed per missed fast', interest: 'Total amount earned' },
    { feature: 'Recipient', zakat: 'Specific 8 categories', sadaqah: 'Anyone in need', lillah: 'Institutions/Public', fidiya: 'Poor & Needy', interest: 'Public welfare' },
    { feature: 'Mosque/School', zakat: <X className="text-destructive" />, sadaqah: <Check className="text-success-foreground" />, lillah: 'Primary use', fidiya: <X className="text-destructive" />, interest: <Check className="text-success-foreground" /> },
];

export default function DonationInfoPage() {
    const { infoSettings, isLoading } = useInfoSettings();

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
            <div key={index} className="space-y-2">
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
