import { NextResponse } from 'next/server';
import { extractKeyInfoFromAadhaar } from '@/ai/flows/extract-key-info-identity';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { photoDataUri } = body;

    if (!photoDataUri) {
      return new NextResponse(JSON.stringify({ error: 'Missing photoDataUri' }), { status: 400 });
    }

    const data = await extractKeyInfoFromAadhaar({ photoDataUri });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/scan-id:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
