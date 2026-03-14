import { redirect } from 'next/navigation';

export default function PublicCampaignIdPage({ params }: { params: { campaignId: string } }) {
  redirect(`/campaign-public/${params.campaignId}/summary`);
}
