import { NextResponse } from 'next/server';
import { scanPaymentScreenshot } from '@/ai/flows/scan-payment';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { photoDataUri } = body;

    if (!photoDataUri) {
      return new NextResponse(JSON.stringify({ error: 'Missing photoDataUri' }), { status: 400 });
    }

    const data = await scanPaymentScreenshot({ photoDataUri });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/scan-payment:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
