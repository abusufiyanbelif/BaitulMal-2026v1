
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Donation Settings',
  description: 'Manage settings for the donation module.',
};

export default function DonationSettingsLayout({
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
