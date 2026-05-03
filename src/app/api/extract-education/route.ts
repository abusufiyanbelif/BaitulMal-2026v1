import { NextResponse } from 'next/server';
import { extractEducationFindings } from '@/ai/flows/extract-education-findings';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reportDataUri } = body;

    if (!reportDataUri) {
      return new NextResponse(JSON.stringify({ error: 'Missing reportDataUri' }), { status: 400 });
    }

    const data = await extractEducationFindings({ reportDataUri });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/extract-education:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
