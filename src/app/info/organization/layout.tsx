import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Organization profile',
  description: 'Meet the team and learn about our core institutional values.',
};

export default function OrgProfileLayout({
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
