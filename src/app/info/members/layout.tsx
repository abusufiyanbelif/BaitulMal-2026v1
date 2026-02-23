import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Organization Members',
  description: 'Meet the team behind our initiatives.',
};

export default function OrgMembersLayout({
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
