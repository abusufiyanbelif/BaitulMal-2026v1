import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Public Initiatives',
  description: 'View all our public campaigns and initiatives.',
};

export default function PublicInitiativesLayout({
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
