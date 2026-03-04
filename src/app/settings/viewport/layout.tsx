import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Display & UI Settings',
  description: 'Manage themes, animations, and visual preferences.',
};

export default function ViewportSettingsLayout({
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
