import { NextResponse } from 'next/server';
import { runDiagnosticCheck } from '@/ai/flows/run-diagnostic-check';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const data = await runDiagnosticCheck();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API Error in /api/run-diagnostic-check:', e);
    return new NextResponse(JSON.stringify({ error: e.message || 'Failed to process the request.' }), { status: 500 });
  }
}
