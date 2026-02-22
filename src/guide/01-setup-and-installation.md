# 1. Setup and Installation

This guide will walk you through the process of setting up your local development environment.

## Table of Contents

-   [Prerequisites](#prerequisites)
-   [Environment Setup](#environment-setup)
    -   [Step 1: Clone and Install Dependencies](#step-1-clone-and-install-dependencies)
    -   [Step 2: Set Up Local Environment Configuration (`.env`)](#step-2-set-up-local-environment-configuration-env)
    -   [Step 3: Set Up Admin SDK Configuration (`serviceAccountKey.json`)](#step-3-set-up-admin-sdk-configuration-serviceaccountkeyjson)
-   [Running the Application](#running-the-application)
    -   [Step 1: Seed the Database](#step-1-seed-the-database)
    -   [Step 2: Start the Development Server](#step-2-start-the-development-server)

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

To run the app locally, you need to store your secret keys and project configuration in an environment file. Next.js uses a special file named `.env.local` for this purpose, which is **never** committed to your version control, keeping your secrets safe.

#### A. Create the `.env` file

In the root of your project, create a file named `.env`.

#### B. Get Firebase Configuration

1.  Navigate to your [Firebase Console](https://console.firebase.google.com/), select your project, go to **Project Settings** (click the gear icon), and under the "General" tab, find the "Your apps" section.
2.  Click on the "Web app" (`</>`) you've registered. Under "Firebase SDK snippet", select the "Config" option.
3.  Copy the key-value pairs from the Firebase config object into your `.env` file. It should look like this:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
    NEXT_PUBLIC_FIREBASE_APP_ID="1:..."
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-..."
    ```

    **Note**: The `NEXT_PUBLIC_` prefix is important. It tells Next.js that it's safe to expose these variables to the browser.

#### C. Get Gemini API Key

The AI features of this application use Google's Gemini models via Genkit.

1.  Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to create and copy your API key.
2.  Add the key to your `.env` file:

    ```env
    GEMINI_API_KEY="your_gemini_api_key"
    ```

    This key is **not** prefixed with `NEXT_PUBLIC_`, so it will only be available on the server-side, which is more secure.

### Step 3: Set Up Admin SDK Configuration (`serviceAccountKey.json`)

**This step is crucial for local development.** The server-side scripts (for seeding, migration, etc.) require administrative privileges to manage your Firebase project.

1.  In the Firebase Console, go to **Project Settings** > **Service accounts**.
2.  Click the **"Generate new private key"** button. A JSON file will be downloaded.
3.  Rename the downloaded file to `serviceAccountKey.json` and place it in the **root directory** of your project. The project's `.gitignore` file is already configured to ignore this sensitive file.

**Note:** This file is **only** for local development. When deployed to a Google Cloud environment like Firebase App Hosting, the Admin SDK automatically uses the environment's built-in credentials.

## Running the Application

Once your environment is configured, you can run the application.

### Step 1: Seed the Database

Before starting the app for the first time, you must seed the database. This script creates the initial administrator user and necessary database structures.

Run the following command in your terminal:

```bash
npm run db:seed
```

This will create an admin user with the following credentials:
-   **Login ID**: `admin`
-   **Password**: `password`

### Step 2: Start the Development Server

Now you can start the Next.js development server.

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

You can now log in using the admin credentials and begin using and developing the application.

---

[**◄ Back to Index**](../README.md) | [**Next: Firebase Configuration ►**](./02-firebase-configuration.md)
