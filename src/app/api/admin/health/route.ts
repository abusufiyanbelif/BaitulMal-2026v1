import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import os from 'os';

export async function GET() {
    const session = await getServerSession();
    if (!session || session.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const health: any = {
        timestamp: new Date().toISOString(),
        system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            loadAvg: os.loadavg(),
            cpus: os.cpus().length,
            freeMem: os.freemem(),
            totalMem: os.totalmem(),
        },
        database: {
            status: 'Offline',
            latency: 0,
        },
        services: [
            { id: 'nextjs', name: 'Next.js App Server', status: 'Online', message: 'Operational' },
            { id: 'firestore', name: 'Cloud Firestore', status: 'Checking...', message: 'Connecting...' },
            { id: 'genkit', name: 'Genkit AI Engine', status: 'Online', message: 'Ready' }
        ]
    };

    const { adminDb } = getAdminServices();

    try {
        const start = Date.now();
        if (adminDb) {
            await adminDb.collection('settings').doc('branding').get();
            health.database.status = 'Online';
            health.database.latency = Date.now() - start;
            health.services[1].status = 'Online';
            health.services[1].message = `Latency: ${health.database.latency}ms`;
        } else {
            throw new Error('Admin Database Service not available');
        }
    } catch (error: any) {
        health.database.status = 'Error';
        health.database.error = error.message;
        health.services[1].status = 'Error';
        health.services[1].message = error.message;
    }

    return NextResponse.json(health);
}
