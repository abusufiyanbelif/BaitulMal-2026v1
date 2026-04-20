import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for the bucket name
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function migrateFiles() {
  const { adminStorage } = getAdminServices();
  if (!adminStorage) {
      console.error('Failed to initialize admin storage.');
      process.exit(1);
  }
  const bucket = adminStorage.bucket();
  
  try {
    const oldLogo = bucket.file('settings/logo');
    const [exists] = await oldLogo.exists();
    if (exists) {
        console.log('Found settings/logo, moving to settings/branding/logo.png...');
        await oldLogo.move('settings/branding/logo.png');
        console.log('Moved successfully.');
    } else {
        console.log('No stray logo found at settings/logo.');
    }

    const oldQr = bucket.file('settings/qr');
    const [qrExists] = await oldQr.exists();
    if (qrExists) {
        console.log('Found settings/qr, moving to settings/payment/qr.png...');
        await oldQr.move('settings/payment/qr.png');
        console.log('Moved successfully.');
    } else {
        console.log('No stray QR found at settings/qr.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateFiles().then(() => process.exit(0));
