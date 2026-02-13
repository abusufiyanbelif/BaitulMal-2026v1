
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Lead Settings',
  description: 'Manage settings for the lead module.',
};

export default function LeadSettingsLayout({
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
