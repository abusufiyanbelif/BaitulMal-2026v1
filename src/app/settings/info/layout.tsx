import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Info Pages Settings',
  description: 'Manage public informational pages.',
};

export default function InfoSettingsLayout({
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
