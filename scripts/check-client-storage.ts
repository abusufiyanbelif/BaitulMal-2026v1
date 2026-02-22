import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadString } from 'firebase/storage'
import 'dotenv/config'

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
})

const storage = getStorage(app)

async function testUpload() {
  const fileRef = ref(storage, 'donations/test-folder/test.txt')
  await uploadString(fileRef, 'Hello world')
  console.log('Upload success')
}

testUpload().catch(console.error)
