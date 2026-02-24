import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Data Analytics',
  description: 'View key metrics and usage statistics for the application.',
};

export default function AnalyticsLayout({
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
