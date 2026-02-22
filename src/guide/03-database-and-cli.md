# 3. Database & CLI Commands

This project includes several command-line interface (CLI) scripts to help manage the database, defined in `package.json`.

## Table of Contents

-   [Prerequisite: Admin SDK Setup](#prerequisite-admin-sdk-setup-for-local-development)
-   [`npm run db:seed`](#npm-run-dbseed)
-   [Data Migration Scripts](#data-migration-scripts)
-   [Utility Scripts](#utility-scripts)

## Prerequisite: Admin SDK Setup for Local Development

Before running any of these commands locally, you **must** have your [Admin SDK Service Account](./02-firebase-configuration.md#admin-sdk-configuration-serviceaccountkeyjson-local-vs-production) (`serviceAccountKey.json`) set up in your project root. This is not required for the deployed application, only for running administrative scripts on your local machine.

---

## `npm run db:seed`

-   **Purpose**: This is the most important script for initial setup. It ensures the default administrator account exists and is correctly configured in both Firebase Authentication and the Firestore database.
-   **When to Run**:
    -   **Before starting the application for the first time.**
    -   If you ever delete the admin user from Authentication or Firestore and need to restore it.
-   **What it Does**:
    1.  Checks if an Auth user exists with the email `admin@example.com`.
    2.  If not, it creates the Auth user with the default password (`password`).
    3.  It then creates or updates all necessary lookup documents in the `user_lookups` collection that point to the admin's email.
    4.  Finally, it creates or updates the admin's user profile document in the `users` collection, ensuring the `role` is set to `Admin`.

---

## Data Migration Scripts

These scripts are used to update your existing data to a newer format after an application update.

### `npm run db:migrate-donations`

-   **Purpose**: Migrates legacy donation records from the old `campaignId` field to the new, more flexible `linkSplit` structure.
-   **When to Run**: Run this script **once** to ensure all older donations are compatible with the latest features that allow linking a single donation to multiple campaigns or leads.

---

## Utility Scripts

### `npm run db:check-structure`

-   **Purpose**: To inspect and report on the current structure of your Firestore database and Firebase Storage bucket. This is a **read-only** script.
-   **When to Run**:
    -   When you want to verify that the expected collections and folders exist.
    -   When debugging to see the top-level organization of your data and files.

### `npm run db:erase`

-   **Purpose**: To completely wipe all application-specific data from your Firestore database and all files from Firebase Storage.
-   **WARNING**: This is a **destructive and irreversible** action. Use it with extreme caution.
-   **What it Does**:
    1.  Deletes all documents from the main data collections (`campaigns`, `leads`, `donations`, `beneficiaries`).
    2.  Deletes all documents from the `users` collection **except** for the user with the `userKey` of `admin`.
    3.  Deletes all corresponding files and folders from Firebase Storage.
    4.  It **does not** delete the admin's authentication account, only their database records. You may need to run `npm run db:seed` again to restore the admin's profile in the database.

---

[**◄ Back to Index**](../README.md) | [**Next: Permissions & Authentication ►**](./04-permissions-and-auth.md)
