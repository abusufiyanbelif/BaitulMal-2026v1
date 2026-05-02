import { NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

export async function POST(req: Request) {
    try {
        const { level, message, metadata, profile } = await req.json();
        const userLogger = createLogger(profile || 'guest');
        
        const logData = {
            ...metadata,
            ip: req.headers.get('x-forwarded-for') || 'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
        };

        if (level === 'error') {
            userLogger.error(message, logData);
        } else if (level === 'warn') {
            userLogger.warn(message, logData);
        } else {
            userLogger.info(message, logData);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to log' }, { status: 500 });
    }
}
