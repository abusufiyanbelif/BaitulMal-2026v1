# 2. Firebase Configuration

A correct Firebase setup is critical for the application to function. This guide covers the essential configuration for both the client-side application and server-side admin scripts.

## Table of Contents

-   [Firebase Project Setup](#firebase-project-setup)
-   [Client-Side Configuration](#client-side-configuration-srcfirebaseconfigts)
-   [Admin SDK Configuration](#admin-sdk-configuration-serviceaccountkeyjson-local-vs-production)
-   [Troubleshooting Connection Issues](#troubleshooting-connection-issues)

## Firebase Project Setup

If you haven't already, create a new project in the [Firebase Console](https://console.firebase.google.com/).

### Required Services & APIs

Ensure the following services are enabled for your project:

1.  **Authentication**:
    -   Go to the **Authentication** section.
    -   Under the "Sign-in method" tab, enable the **Email/Password** provider. This is required for the database seeding script to create the initial admin user.

2.  **Firestore Database**:
    -   Go to the **Firestore Database** section and click **"Create database"**.
    -   Start in **production mode** and choose a location.

3.  **Storage**:
    -   Go to the **Storage** section and click **"Get started"**.

In the Google Cloud Console, you must also enable the following APIs for your project:
- **Identity Toolkit API** (for Firebase Authentication)
- **Cloud Firestore API**
- **Cloud Storage API**
- **Generative Language API** (for AI features)

For details on the necessary IAM roles for your service account, see the [Permissions & Authentication](./04-permissions-and-auth.md) guide.

## Client-Side Configuration (`src/firebase/config.ts`)

The client-side application connects to Firebase using configuration from your `.env` file, which is consumed by `src/firebase/config.ts`.

-   **Purpose**: It provides public keys and project identifiers that the Firebase SDK needs to connect from the user's browser. It is safe to expose these keys publicly, as security is enforced by your **Security Rules**.
-   **Source**: The `.env` file in your project root.

You should not need to modify `src/firebase/config.ts` directly.

## Admin SDK Configuration (`serviceAccountKey.json`): Local vs. Production

Server-side scripts (e.g., for database seeding) require administrative access. This is handled differently in local development versus production.

### Local Development

-   **File**: `serviceAccountKey.json`
-   **Location**: Project root directory.
-   **Purpose**: This file contains a private key that grants your local scripts administrative privileges, allowing them to bypass all security rules. This is **required** to run commands like `npm run db:seed`.
-   **Security**: **This file is highly sensitive and must never be committed to version control.**

### Production (Firebase App Hosting)

-   **No File Needed**: You **do not** deploy the `serviceAccountKey.json` file.
-   **Mechanism**: The Admin SDK automatically authenticates using the runtime environment's default service account.
-   **Configuration**: You must ensure this service account has the correct IAM permissions in your Google Cloud project. See the [Permissions guide](./04-permissions-and-auth.md) for details.

## Troubleshooting Connection Issues

-   **"Firebase: Error (auth/configuration-not-found)"**: The **Email/Password** sign-in provider is likely not enabled in Firebase Authentication settings.
-   **"Missing or insufficient permissions" (Firestore)**: Your Firestore Security Rules are blocking an action. Check the browser's developer console for the denied path and operation, then review `firestore.rules`.
-   **"Storage: User does not have permission to access..."**: Your Cloud Storage Security Rules are blocking an action. Review `storage.rules`.

---

[**◄ Back to Index**](../README.md) | [**Next: Database & CLI Commands ►**](./03-database-and-cli.md)
