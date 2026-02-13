
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Beneficiary Settings',
  description: 'Manage settings for the beneficiary module.',
};

export default function BeneficiarySettingsLayout({
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
