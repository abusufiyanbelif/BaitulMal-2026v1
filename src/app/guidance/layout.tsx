import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Guidance Hub',
  description: 'Manage institutional help resources and external guidance directory.',
};

export default function GuidanceHubLayout({
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
