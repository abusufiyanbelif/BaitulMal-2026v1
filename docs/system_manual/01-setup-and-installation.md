# 1. Setup and Installation

This guide will walk you through the process of setting up your local development environment.

## Table of Contents

-   [Prerequisites](#prerequisites)
-   [Environment Setup](#environment-setup)
-   [Running the Application](#running-the-application)

## Prerequisites

Before you begin, ensure you have the following installed on your system:

-   **Node.js**: Version 18.x or higher.
-   **npm**: Should be included with your Node.js installation.
-   **A Google Account**: To create and manage your Firebase project.

## Environment Setup

Follow these steps to get the project running on your local machine.

### Step 1: Clone and Install Dependencies

First, clone the repository and install the necessary npm packages.

```bash
# Clone the repository (if you haven't already)
git clone <repository_url>
cd <project_directory>

# Install dependencies
npm install
```

### Step 2: Set Up Local Environment Configuration (`.env`)

To run the app locally, you need to store your secret keys and project configuration in an environment file. This file is named `.env` and is **never** committed to version control, keeping your secrets safe.

| Variable                               | Description                                                                                              |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`         | Your web app's Firebase API key.                                                                         |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`     | Your Firebase project's `authDomain`.                                                                    |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`      | Your Firebase project ID.                                                                                |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`  | Your Firebase project's Cloud Storage bucket.                                                            |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Your app's messaging sender ID.                                                                          |
| `NEXT_PUBLIC_FIREBASE_APP_ID`          | Your Firebase web app's unique ID.                                                                       |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`  | Your app's Google Analytics measurement ID.                                                              |
| `GEMINI_API_KEY`                       | Your API key for the Gemini model (from Google AI Studio). This is a **server-side** secret.             |

To get these values:
1.  **Firebase Config:** Navigate to your [Firebase Console](https://console.firebase.google.com/), go to **Project Settings**, and under the "Your apps" section, find your web app's "Firebase SDK snippet". Select the "Config" option.
2.  **Gemini Key:** Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to create and copy your API key.

### Step 3: Set Up Admin SDK Configuration (`serviceAccountKey.json`)

**This step is crucial for local development.** Your application contains server-side scripts (like `npm run db:seed`) that require administrative privileges to manage your Firebase project. This is not needed for the deployed application in production.

| File                  | Purpose                                                                                                                                                                                            | Security                                                                              |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `serviceAccountKey.json` | Contains a private key that grants your local scripts superuser access to bypass all security rules. This allows scripts to create users, migrate data, and manage files without restrictions. | **Highly Sensitive.** This file must **never** be committed to version control. |

To get this file:
1.  In the Firebase Console, go to **Project Settings** > **Service accounts**.
2.  Click the **"Generate new private key"** button.
3.  Rename the downloaded file to `serviceAccountKey.json` and place it in the **root directory** of your project.

## Running the Application

### Step 1: Seed the Database

Before starting the app for the first time, you must seed the database. This script creates the initial administrator account.

```bash
npm run db:seed
```

### Step 2: Start the Development Server

Now you can start the Next.js development server.

```bash
npm run dev
```

The application will be available at `http://localhost:3000` (or `9002` if configured).

## Deployment to Firebase

Deploying the BaitulMal system to Firebase can be done via Firebase Hosting (Static Export) or Firebase App Hosting (SSR). Since this application relies on Next.js Server Actions and SSR, **Firebase App Hosting** is the recommended route, but we will cover standard Firebase Hosting for static exports as well.

### 1. Preparing for Deployment

Before deploying, ensure your code compiles without TypeScript or Linting errors:
```bash
# Run a strict type check
npx tsc --noEmit

# Build the project to verify there are no missing dependencies or syntax errors
npm run build
```

**Debugging Build Errors:**
- If `npm run build` fails with `ESLint` errors, you can bypass them (not recommended) by setting `ignoreDuringBuilds: true` in `next.config.js`.
- If you face `FirebaseError: Missing or insufficient permissions`, ensure your `firestore.rules` and `storage.rules` are correctly deployed before launching the app.

### 2. Deploying Security Rules & Indexes

Always deploy your database rules, storage rules, and indexes before the application code so that the app functions correctly upon launch.

```bash
# Login to Firebase CLI
firebase login

# Set the active project
firebase use baitulmal-production

# Deploy only Firestore rules and indexes
firebase deploy --only firestore

# Deploy Cloud Storage rules
firebase deploy --only storage
```

**Debugging Deployment Errors:**
- *Error: Unable to parse firestore.rules*: Check for trailing commas or syntax errors in your rules file. You can test rules locally using the Firebase Emulator Suite (`firebase emulators:start`).
- *Error: Index creation failed*: If deploying indexes via `firebase deploy --only firestore:indexes` fails, follow the direct link provided in the Firebase CLI error output to build the index manually in the Firebase Console.

### 3. Deploying the Application Code (Firebase App Hosting)

Firebase App Hosting automatically manages the build and deployment pipeline for Next.js applications directly from your GitHub repository.

1. Navigate to your [Firebase Console](https://console.firebase.google.com).
2. Go to **Build > App Hosting**.
3. Click **Get Started** and connect your GitHub repository.
4. Select the branch (e.g., `main`).
5. Configure your Environment Variables. You MUST add the following secrets via the App Hosting dashboard:
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - (And all other `NEXT_PUBLIC_` variables from your `.env`)
6. Click **Deploy**. Firebase will automatically run `npm run build` and provision Cloud Run instances.

**Debugging App Hosting:**
- If the rollout fails, check the Cloud Build logs provided in the App Hosting dashboard. Most failures are due to missing environment variables or TypeScript errors.

### 4. Alternative: Deploying via Firebase Hosting (Static Export)

If you are not using Server Actions and want to deploy as a static site (SPA):
1. Update `next.config.js` to include `output: 'export'`.
2. Run `npm run build`. This generates an `out/` directory.
3. Initialize Firebase Hosting:
   ```bash
   firebase init hosting
   # When asked for the public directory, type: out
   # Configure as a single-page app: Yes
   ```
4. Deploy the static assets:
   ```bash
   firebase deploy --only hosting
   ```

---

[**◄ Back to Index**](../README.md) | [**Next: Firebase Configuration ►**](./02-firebase-configuration.md)
