import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Donation Summary',
  description: 'Summary of donations for the campaign.',
};

export default function DonationSummaryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
    </>
  );
}
