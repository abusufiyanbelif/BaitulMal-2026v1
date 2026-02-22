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

The application will be available at `http://localhost:9002`.

---

[**◄ Back to Index**](../README.md) | [**Next: Firebase Configuration ►**](./02-firebase-configuration.md)
