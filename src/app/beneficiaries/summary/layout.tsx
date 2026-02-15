import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Beneficiaries Summary',
  description: 'A summary of all beneficiaries.',
};

export default function BeneficiariesSummaryLayout({
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
