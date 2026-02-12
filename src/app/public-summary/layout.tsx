import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Public Summary',
  description: 'Preview the public-facing campaign and lead pages.',
};

export default function PublicSummaryLayout({
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
