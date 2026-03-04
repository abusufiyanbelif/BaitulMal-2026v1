import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Our Guiding Principles',
  description: 'To ensure our operations are transparent, fair, and impactful, we adhere to a clear set of guiding principles.',
};

export default function GuidingPrinciplesLayout({
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
