import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from '@/lib/auth-server';

const LOGS_ROOT = path.join(process.cwd(), 'logs');
const DOCS_ROOT = path.join(process.cwd(), 'docs');

export async function GET(req: Request) {
    const session = await getServerSession();
    if (!session || session.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'logs'; // 'logs' or 'docs'
    const subDir = searchParams.get('dir') || 'runtime';
    const fileName = searchParams.get('file');
    const download = searchParams.get('download') === 'true';

    const baseRoot = category === 'docs' ? DOCS_ROOT : LOGS_ROOT;
    const targetDir = path.join(baseRoot, subDir);

    try {
        if (fileName) {
            const filePath = path.join(targetDir, fileName);
            if (!filePath.startsWith(baseRoot)) throw new Error('Path traversal detected');
            
            if (!fs.existsSync(filePath)) {
                return NextResponse.json({ error: 'File not found' }, { status: 404 });
            }

            if (download) {
                const fileBuffer = fs.readFileSync(filePath);
                return new Response(fileBuffer, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${fileName}"`,
                    },
                });
            }

            const content = fs.readFileSync(filePath, 'utf8');
            return NextResponse.json({ content });
        } else {
            // List files in directory
            if (!fs.existsSync(targetDir)) return NextResponse.json({ files: [], path: targetDir });
            
            const files = fs.readdirSync(targetDir)
                .map(file => {
                    const stats = fs.statSync(path.join(targetDir, file));
                    return {
                        name: file,
                        size: stats.size,
                        mtime: stats.mtime,
                        isDir: stats.isDirectory()
                    };
                })
                .filter(f => !f.isDir) // Only show files for now
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            
            return NextResponse.json({ 
                files, 
                path: targetDir 
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session || session.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { action, files, category, dir } = body;

        const baseRoot = category === 'docs' ? DOCS_ROOT : LOGS_ROOT;
        const targetDir = path.join(baseRoot, dir);

        if (action === 'delete_multiple') {
            for (const file of files) {
                const filePath = path.join(targetDir, file);
                if (filePath.startsWith(baseRoot) && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return NextResponse.json({ success: true });
        }

        if (action === 'archive_multiple') {
            const archiveDir = path.join(baseRoot, 'archived');
            if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

            for (const file of files) {
                const filePath = path.join(targetDir, file);
                const destPath = path.join(archiveDir, `${Date.now()}_${file}`);
                if (filePath.startsWith(baseRoot) && fs.existsSync(filePath)) {
                    fs.renameSync(filePath, destPath);
                }
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession();
    if (!session || session.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'logs';
    const subDir = searchParams.get('dir') || 'runtime';
    const fileName = searchParams.get('file');

    if (!fileName) return NextResponse.json({ error: 'File name required' }, { status: 400 });

    try {
        const baseRoot = category === 'docs' ? DOCS_ROOT : LOGS_ROOT;
        const filePath = path.join(baseRoot, subDir, fileName);
        if (!filePath.startsWith(baseRoot)) throw new Error('Path traversal detected');
        fs.unlinkSync(filePath);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
