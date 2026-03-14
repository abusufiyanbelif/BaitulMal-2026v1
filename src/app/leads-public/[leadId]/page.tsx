import { redirect } from 'next/navigation';

export default function PublicLeadIdPage({ params }: { params: { leadId: string } }) {
  redirect(`/leads-public/${params.leadId}/summary`);
}
