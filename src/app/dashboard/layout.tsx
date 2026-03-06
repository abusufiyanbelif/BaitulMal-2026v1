import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage institutional campaigns, leads, and community donations.',
};

export default function DashboardLayout({
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
