
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'User Settings',
  description: 'Manage settings for the user module.',
};

export default function UserSettingsLayout({
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
