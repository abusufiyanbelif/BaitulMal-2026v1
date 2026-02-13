
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Campaign Settings',
  description: 'Manage settings for the campaign module.',
};

export default function CampaignSettingsLayout({
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
