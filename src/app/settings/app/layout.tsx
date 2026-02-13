
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'App Settings',
  description: 'Manage application branding and payments.',
};

export default function AppSettingsLayout({
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
