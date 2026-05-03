import { NextResponse } from 'next/server';
import { createLeadStory } from '@/ai/flows/create-lead-story';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reportDataUris } = body;

    if (!reportDataUris || !Array.isArray(reportDataUris) || reportDataUris.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Missing reportDataUris' }), { status: 400 });
    }

    const data = await createLeadStory({ reportDataUris });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/create-lead-story:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
