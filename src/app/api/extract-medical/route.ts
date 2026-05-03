import { NextResponse } from 'next/server';
import { extractMedicalFindings } from '@/ai/flows/extract-medical-findings';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reportDataUri } = body;

    if (!reportDataUri) {
      return new NextResponse(JSON.stringify({ error: 'Missing reportDataUri' }), { status: 400 });
    }

    const data = await extractMedicalFindings({ reportDataUri });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/extract-medical:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
