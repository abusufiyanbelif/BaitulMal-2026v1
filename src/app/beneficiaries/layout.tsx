
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Beneficiaries',
  description: 'Manage master list of all beneficiaries.',
};

export default function BeneficiariesLayout({
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
