import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
    try {
        const { level, message, metadata, profile } = await req.json();
        
        const logData = {
            ...metadata,
            clientTimestamp: new Date().toISOString(),
            userAgent: req.headers.get('user-agent'),
            ip: req.headers.get('x-forwarded-for') || 'unknown'
        };

        if (level === 'error') {
            logger.error(message, logData);
        } else if (level === 'warn') {
            logger.warn(message, logData);
        } else {
            logger.info(message, logData);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
