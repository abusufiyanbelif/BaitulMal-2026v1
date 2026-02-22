# 2. Firebase Configuration

A correct Firebase setup is critical for the application to function. This guide covers the essential configuration for both the client-side application and server-side admin scripts.

## Table of Contents

-   [Firebase Project Setup](#firebase-project-setup)
-   [Client-Side vs. Server-Side Configuration](#client-side-vs-server-side-configuration)
-   [Troubleshooting Connection Issues](#troubleshooting-connection-issues)

## Firebase Project Setup

If you haven't already, create a new project in the [Firebase Console](https://console.firebase.google.com/).

### Required Services & APIs

Ensure the following services are enabled for your project:

1.  **Authentication**:
    -   Go to the **Authentication** section.
    -   Under the "Sign-in method" tab, enable the **Email/Password** provider.

2.  **Firestore Database**:
    -   Go to the **Firestore Database** section and click **"Create database"**.
    -   Start in **production mode** and choose a location.

3.  **Storage**:
    -   Go to the **Storage** section and click **"Get started"**.

In the Google Cloud Console, you must also enable the following APIs for your project:
- **Identity Toolkit API**
- **Cloud Firestore API**
- **Cloud Storage API**
- **Generative Language API**

## Client-Side vs. Server-Side Configuration

The application interacts with Firebase in two distinct ways, each with its own configuration method.

### 1. Client-Side (Browser)

This is how the application connects to Firebase from the user's browser.

| File           | Purpose                                                                                                                                                                            | Security                                                                                             |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `.env`         | Stores the public Firebase configuration keys (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`).                                                                                              | These keys are safe to expose publicly. They identify your Firebase project but do not grant any special access. |
| `src/firebase/config.ts` | Consumes the variables from `.env` and exports a configuration object for the Firebase client SDK.                                                                       | Security for client-side operations is enforced by your **Firestore and Storage Security Rules**.          |

### 2. Server-Side (Admin SDK)

This is how administrative scripts (like `npm run db:*`) and Server Actions connect to Firebase with elevated privileges.

| Environment  | Configuration Method                                                                                                                 | Why it's needed                                                                                              |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **Local Development** | Uses the **`serviceAccountKey.json`** file in your project root.                                                                 | Grants your local machine's scripts admin rights to bypass all security rules for seeding, migrations, etc.  |
| **Production** (Firebase App Hosting) | **No file needed.** It automatically uses the Google Cloud environment's default service account credentials.      | Your deployed application's server-side code runs in a trusted environment with inherent admin access.     |

**The "Admin SDK initialization failed" error occurs when you run a script locally without a valid `serviceAccountKey.json` file in your project's root directory.**

## Troubleshooting Connection Issues

-   **"Firebase: Error (auth/configuration-not-found)"**: The **Email/Password** sign-in provider is likely not enabled in Firebase Authentication settings.
-   **"Missing or insufficient permissions" (Firestore)**: Your Firestore Security Rules are blocking an action.
-   **"Storage: User does not have permission to access..."**: Your Cloud Storage Security Rules are blocking an action.

---

[**◄ Back to Index**](../README.md) | [**Next: Database & CLI Commands ►**](./03-database-and-cli.md)
