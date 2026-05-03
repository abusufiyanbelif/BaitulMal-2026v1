import { NextResponse } from 'next/server';
import { createEducationStory } from '@/ai/flows/create-education-story';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reportDataUris } = body;

    if (!reportDataUris || !Array.isArray(reportDataUris) || reportDataUris.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Missing reportDataUris' }), { status: 400 });
    }

    const data = await createEducationStory({ reportDataUris });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/create-education-story:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
