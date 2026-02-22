# 4. Permissions & Authentication

This guide provides a comprehensive overview of the application's security model, covering end-user roles, server-side script permissions, and the necessary Google Cloud configurations.

## Table of Contents

-   [1. Actors & Roles](#1-actors--roles)
-   [2. Google Cloud & Firebase Project Configuration](#2-google-cloud--firebase-project-configuration)
-   [3. Application Security Deep Dive](#3-application-security-deep-dive)
-   [4. Troubleshooting Access Errors](#4-troubleshooting-access-errors)

## 1. Actors & Roles

There are three main "actors" that interact with your Firebase project, each with different levels of access:

### a. Application Users (Your App's End-Users)

These are the people who log in and use your application. Their access is controlled by **Firestore and Storage Security Rules**.

*   **Admin Role**: Has full, unrestricted access to all data within the application. This is defined by a `role: "Admin"` field in their user document in Firestore.
*   **User Role**: Has limited access based on a granular `permissions` object stored in their user document. By default, new users have no permissions.

### b. Admin SDK / CLI Scripts (Service Account)

These are the `npm run db:*` scripts used for administrative tasks like seeding the database. They run in a trusted server environment (your local machine or a cloud instance) and authenticate using a **Service Account**.

*   **Privileges**: This actor has **superuser access** and **bypasses all security rules**. It needs broad permissions to manage users, read/write/delete any data, and manage files.
*   **Authentication (Local)**: Uses the `serviceAccountKey.json` file in your project root.
*   **Authentication (Production)**: Automatically uses the environment's service account credentials on Firebase App Hosting.

### c. Client-Side Application (The Browser)

This is the Next.js/React code running in the user's browser.

*   **Privileges**: It has **no inherent privileges**. All database and storage operations initiated from the client are authenticated as the *currently logged-in Application User* and are subject to security rules.
*   **Authentication**: It uses the public Firebase configuration from your `.env` file.

---

## 2. Google Cloud & Firebase Project Configuration

For the application and admin scripts to function, certain APIs must be enabled and permissions must be granted in your Google Cloud project.

### a. Required Google Cloud APIs

Ensure the following APIs are **Enabled** in your project's [Google Cloud Console](https://console.cloud.google.com/apis/library):

*   **Identity Toolkit API**: For Firebase Authentication (user management).
*   **Cloud Firestore API**: For database access.
*   **Cloud Storage API**: For file storage.
*   **Generative Language API**: For AI features (Genkit/Gemini).

### b. Required IAM Permissions for Admin Scripts

The service account used by your development environment needs the following IAM roles. You can add these in the [IAM section of the Google Cloud Console](https://console.cloud.google.com/iam-admin/iam).

*   **Firebase Admin**: A comprehensive role granting full access to Firebase services.
*   **Service Account User**: Allows the environment to impersonate the service account.

---

## 3. Application Security Deep Dive

### a. User Permissions Structure

Permissions for non-admin users are defined in the `permissions` field of their user document (`/users/{userId}`). The UI dynamically shows/hides features based on these flags.

*   **Admin Override**: If a user's document has `role: "Admin"`, the `permissions` object is ignored by the security rules, which grant access based on the `isAdmin()` function.
*   **Example Check**: The rules check for a specific permission like this: `hasPermission('campaigns', 'create')`. This corresponds to `permissions.campaigns.create: true` in the user's document.

### b. Login Mechanism (`user_lookups`)

To allow users to sign in with a custom `loginId` instead of an email, the application uses a lookup collection.

*   **Collection**: `user_lookups`
*   **How it Works**:
    1.  When a user enters a `loginId` (e.g., "admin"), the app queries `user_lookups/admin`.
    2.  This document contains the user's actual `email`.
    3.  The app then uses the retrieved email and the provided password to sign the user in with Firebase's standard email/password method.
*   **Security**: This collection is publicly readable, which is safe as it only maps a non-sensitive ID to an email.

---

## 4. Troubleshooting Access Errors

If you see a "Missing or insufficient permissions" error:

1.  **Check the Browser Console**: The developer console contains a detailed error message from `src/firebase/errors.ts`, including the operation (`read`, `write`) and the Firestore path that was denied.
2.  **Review `firestore.rules` or `storage.rules`**: Open the relevant rules file.
3.  **Find the Matching Rule**: Locate the `match` block that corresponds to the path in the error.
4.  **Verify the `isAdmin()` Function**: For admin errors, ensure your user document in Firestore (`users/{your_auth_uid}`) has the field `role` set to the string `"Admin"`.
5.  **Check User-Specific Rules**: For non-admin errors, verify path ownership rules (e.g., `isOwner(userId)`) and `hasPermission()` checks. Ensure the user's `permissions` object in their Firestore document contains the necessary `true` flag for the action they are trying to perform.
6.  **Use the Diagnostics Page**: Navigate to `/diagnostics` in the app. The tests for Firestore Connectivity and Admin User records can help pinpoint rule-related issues.

---

[**◄ Back to Index**](../README.md) | [**Next: Genkit AI Flows ►**](./05-genkit-ai-flows.md)
