
import { getAdminServices } from '../src/lib/firebase-admin-sdk';

async function migrateSettings() {
    console.log('🚀 Starting Settings File & Data Migration...');
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        throw new Error("Admin SDK not initialized.");
    }

    const bucket = adminStorage.bucket();

    async function moveFile(oldPath: string, newPath: string) {
        const file = bucket.file(oldPath);
        const [exists] = await file.exists();
        if (exists) {
            console.log(`  - Moving ${oldPath} to ${newPath}`);
            await file.move(newPath);
            return true;
        }
        return false;
    }

    try {
        // 1. Migrate Logo
        const logoMoved = await moveFile('settings/logo', 'settings/branding/logo.png');
        if (logoMoved) {
            const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent('settings/branding/logo.png')}?alt=media`;
            await adminDb.collection('settings').doc('branding').set({ logoUrl }, { merge: true });
            console.log('  ✅ Logo migration complete.');
        }

        // 2. Migrate QR Code
        const qrMoved = await moveFile('settings/payment_qr', 'settings/payment/qr_code.png');
        if (qrMoved) {
            const qrCodeUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent('settings/payment/qr_code.png')}?alt=media`;
            await adminDb.collection('settings').doc('payment').set({ qrCodeUrl }, { merge: true });
            console.log('  ✅ QR Code migration complete.');
        }

        console.log('\n✅ Settings migration finished successfully.');
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrateSettings();
