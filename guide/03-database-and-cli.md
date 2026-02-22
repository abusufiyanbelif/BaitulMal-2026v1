# 3. Database & CLI Commands

This project includes several command-line interface (CLI) scripts to help manage the database. These are defined in the `scripts` section of your `package.json` file.

**Prerequisite**: Before running any of these commands, you must have your [Admin SDK Service Account](./02-firebase-configuration.md#b-admin-sdk-configuration-service-account) (`serviceAccountKey.json`) set up in your project root.

## `npm run db:seed`

-   **Purpose**: This is the most important script for initial setup. It ensures the default administrator account exists and is correctly configured in both Firebase Authentication and the Firestore database.
-   **When to Run**:
    -   **Before starting the application for the first time.**
    -   If you ever delete the admin user from Authentication or Firestore and need to restore it.
-   **What it Does**:
    1.  Checks if an Auth user exists with the email `admin@example.com`.
    2.  If not, it creates the Auth user with the default password (`password`).
    3.  It then creates or updates all necessary lookup documents in the `user_lookups` collection (`admin`, `admin_key`, phone number) that point to the admin's email.
    4.  Finally, it creates or updates the admin's user profile document in the `users` collection, ensuring the `role` is set to `Admin`.

## `npm run db:migrate-numbers`

-   **Purpose**: To assign sequential, human-readable numbers (`campaignNumber`, `leadNumber`) to any existing Campaigns and Leads that were created before the numbering system was implemented.
-   **When to Run**: Run this script **once** after the feature has been deployed to backfill numbers for all your old records.
-   **What it Does**: It safely scans all Campaigns and Leads, finds the highest existing number, and then assigns new, sequential numbers to any documents that are missing one. It does this transactionally to prevent duplicate numbers.

## `npm run db:migrate-categories`

-   **Purpose**: Migrates older campaign/lead data structures to the newer, more flexible `itemCategories` format.
-   **When to Run**: Only if you have data from a previous version of the application that used the `rationLists` object instead of the `itemCategories` array. If you started with a fresh project, you will likely never need this.
-   **What it Does**: It iterates through all documents in the `campaigns` and `leads` collections, converts the old `rationLists` format into the `itemCategories` array structure, and updates the documents.

## `npm run db:migrate-donations`

-   **Purpose**: Migrates legacy donation records from the old `campaignId` field to the new, more flexible `linkSplit` structure.
-   **When to Run**: Run this script **once** to ensure all older donations are compatible with the latest features that allow linking a single donation to multiple campaigns or leads.
-   **What it Does**: It scans all documents in the `donations` collection. For any donation that has a `campaignId` but no `linkSplit`, it creates a new `linkSplit` array containing the original campaign information and removes the old, redundant fields.

## `npm run db:erase`

-   **Purpose**: To completely wipe all application-specific data from your Firestore database and all files from Firebase Storage.
-   **WARNING**: This is a **destructive and irreversible** action. Use it with extreme caution.

-   **When to Run**:
    -   When you want to reset your development environment to a clean slate.
    -   Before seeding a fresh database for testing or a new deployment.
-   **What it Does**:
    1.  Deletes all documents from the `campaigns`, `leads`, `donations`, and `beneficiaries` collections.
    2.  Deletes all documents from the `users` collection **except** for the user with the `userKey` of `admin`.
    3.  Deletes all corresponding files and folders from Firebase Storage.
    4.  It **does not** delete the admin's authentication account, only their database records. You may need to run `npm run db:seed` again to restore the admin's profile in the database.

---

[**◄ Back to Index**](../README.md) | [**Next: Permissions & Authentication ►**](./04-permissions-and-auth.md)
