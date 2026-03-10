import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Guidance & Resources Settings',
  description: 'Manage external help resources and community guidance.',
};

export default function GuidanceSettingsLayout({
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
