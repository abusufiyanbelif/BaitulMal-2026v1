const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'docuextract-q8vaa.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function fixLogoUrl() {
  try {
    const file = bucket.file('settings/branding/logo.png');
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('Error: settings/branding/logo.png does not exist in bucket!');
      return;
    }

    // Construct the public URL (since we set rules to public)
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/docuextract-q8vaa.firebasestorage.app/o/settings%2Fbranding%2Flogo.png?alt=media`;
    
    // Or generate a signed URL / download URL. 
    // In Firebase Storage, files uploaded via the Client SDK have a download token in metadata.
    // Files uploaded via Admin SDK don't have it unless generated.
    // Let's get the file metadata and see if it has a token!
    const [metadata] = await file.getMetadata();
    let downloadUrl = publicUrl;
    
    if (metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens) {
      const token = metadata.metadata.firebaseStorageDownloadTokens.split(',')[0];
      downloadUrl = `https://firebasestorage.googleapis.com/v0/b/docuextract-q8vaa.firebasestorage.app/o/settings%2Fbranding%2Flogo.png?alt=media&token=${token}`;
    } else {
      // If no token, we can add a new one!
      const token = 'system-generated-fix-' + Date.now();
      await file.setMetadata({
        metadata: {
          firebaseStorageDownloadTokens: token
        }
      });
      downloadUrl = `https://firebasestorage.googleapis.com/v0/b/docuextract-q8vaa.firebasestorage.app/o/settings%2Fbranding%2Flogo.png?alt=media&token=${token}`;
    }

    console.log('Fixing logo URL to:', downloadUrl);

    await db.collection('settings').doc('branding').update({
      logoUrl: downloadUrl
    });

    console.log('Firestore branding updated successfully!');
  } catch (error) {
    console.error('Error fixing logo URL:', error);
  }
}

fixLogoUrl();
