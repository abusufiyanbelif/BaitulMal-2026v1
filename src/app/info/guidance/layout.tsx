import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Community Resource Directory',
  description: 'A comprehensive directory of external assistance resources including hospitals, NGOs, and government schemes.',
};

export default function GuidancePublicLayout({
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
