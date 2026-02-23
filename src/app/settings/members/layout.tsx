
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Organization Members',
  description: 'Manage the details of your organization\'s members and teams.',
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
