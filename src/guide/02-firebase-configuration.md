# 2. Firebase Configuration

A correct Firebase setup is critical for the application to function. This guide covers the essential configuration for both the client-side application and server-side admin scripts.

## Firebase Project Setup

If you haven't already, create a new project in the [Firebase Console](https://console.firebase.google.com/).

### Required Services & APIs

Ensure the following services are enabled for your project:

1.  **Authentication**:
    -   Go to the **Authentication** section.
    -   Under the "Sign-in method" tab, enable the **Email/Password** provider. This is required for the database seeding script to create the initial admin user.
    -   You can also enable **Anonymous** if you wish, but Email/Password is mandatory for setup.

2.  **Firestore Database**:
    -   Go to the **Firestore Database** section.
    -   Click **"Create database"**.
    -   Start in **production mode**.
    -   Choose a location for your database (e.g., `us-central`). This cannot be changed later.
    -   The initial security rules will be restrictive; we will manage them via the `firestore.rules` file in the project.

3.  **Storage**:
    -   Go to the **Storage** section.
    -   Click **"Get started"** and follow the prompts to enable it. Use the default security rules for now.

In the Google Cloud Console, you must also enable the following APIs for your project:
- **Identity Toolkit API** (for Firebase Authentication)
- **Cloud Firestore API**
- **Cloud Storage for Firebase API**
- **Generative Language API** (for AI features)

### Required IAM Permissions for Admin Scripts

The Admin SDK scripts (like `db:seed`) require your development environment's service account to have elevated permissions. Ensure the service account has the following IAM roles:
-   **Firebase Admin** (or the more granular `Firebase Authentication Admin`, `Cloud Datastore User`, `Storage Admin`)
-   **Service Account User**

## Client-Side Configuration (`src/firebase/config.ts`)

The client-side application connects to Firebase using a configuration object. This configuration is stored in the `.env` file and consumed by `src/firebase/config.ts`.

-   **Location**: `src/firebase/config.ts`
-   **Source of Truth**: `.env` file
-   **Purpose**: It provides the public keys and project identifiers that the Firebase SDK needs to connect to your project from the user's browser. It is safe to expose these keys publicly, as security is enforced by your **Security Rules**.

You should not need to modify `src/firebase/config.ts` directly. All configuration should be managed via the `.env` file as described in the [Setup and Installation](./01-setup-and-installation.md) guide.

## Admin SDK Configuration (`serviceAccountKey.json`)

Server-side scripts (e.g., for database seeding) require administrative access to your Firebase project. This is achieved using a **service account**.

-   **File**: `serviceAccountKey.json`
-   **Location**: Project root directory.
-   **Purpose**: This file contains a private key that grants your scripts administrative privileges, allowing them to bypass all security rules.
-   **Security**: **This file is highly sensitive and must never be committed to version control.** The project's `.gitignore` file is pre-configured to ignore it.

For detailed steps on obtaining this file, refer to the [Setup and Installation](./01-setup-and-installation.md) guide.

## Troubleshooting Connection Issues

**Error: "Firebase: Error (auth/configuration-not-found)"**
-   **Cause**: This usually means the **Email/Password** sign-in provider is not enabled in the Firebase Authentication settings.
-   **Solution**: Go to the Firebase Console > Authentication > Sign-in method and enable the "Email/Password" provider.

**Error: "Missing or insufficient permissions" from Firestore**
-   **Cause**: Your Firestore Security Rules are blocking a requested action.
-   **Solution**:
    1.  Check the browser's developer console for a detailed error message, which often includes the path and operation that was denied.
    2.  Review your `firestore.rules` file to ensure the rules for that path and operation are correct.
    3.  Refer to the [Permissions & Authentication](./04-permissions-and-auth.md) guide for a detailed explanation of the rules structure.

**Error: "Storage: User does not have permission to access..."**
-   **Cause**: Your Cloud Storage Security Rules are blocking a file read or write.
-   **Solution**: Review your `storage.rules` file. Ensure that authenticated users and administrators have the correct permissions for the required paths (e.g., `users/{userId}/...`).

---

[**◄ Back to Index**](../README.md) | [**Next: Database & CLI Commands ►**](./03-database-and-cli.md)
