
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Donation Types Explained',
  description: 'Learn the differences between Zakat, Sadaqah, Lillah, and Interest (Riba) to make informed contributions.',
};

export default function DonationInfoLayout({
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
