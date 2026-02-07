import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Beneficiary Details',
  description: 'Beneficiary details for the lead.',
};

export default function BeneficiaryLayout({
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
