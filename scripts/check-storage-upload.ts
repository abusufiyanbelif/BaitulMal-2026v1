import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import * as admin from 'firebase-admin'
import fs from 'fs'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
}

const bucket = admin.storage().bucket()

async function testUpload() {
  const filePath = 'diagnostics/test-upload.txt'
  const tempFile = './test-upload.txt'

  fs.writeFileSync(tempFile, 'Firebase storage diagnostic test')

  await bucket.upload(tempFile, {
    destination: filePath,
  })

  console.log('✅ Admin upload successful:', filePath)
}

testUpload().catch(console.error)
