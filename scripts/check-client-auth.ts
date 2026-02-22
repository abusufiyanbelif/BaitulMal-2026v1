import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
})

const auth = getAuth(app)

console.log("Current user:", auth.currentUser)
