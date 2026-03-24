# 15. Data Migration & Seeding Guide

This guide provides the necessary commands and procedures for initializing the database and migrating legacy data to the latest organizational standards.

## 1. Prerequisite: Admin SDK Setup

To run any of the commands listed in this guide from your local terminal, you must first establish administrative credentials.

1.  Navigate to the **Firebase Console** > **Project Settings** > **Service Accounts**.
2.  Click **"Generate New Private Key"**.
3.  Rename the downloaded file to `serviceAccountKey.json`.
4.  Place it in the **Project Root** directory. 
    *   *Note: This file is ignored by git and must never be shared or committed.*

---

## 2. Initial System Setup

### `npm run db:seed`
**Purpose**: Creates the initial "Superuser" administrator and establishes the core database structure.
*   Creates an account with Email: `admin@example.com` and Password: `password`.
*   Initializes the `user_lookups` registry.
*   Ensures the Admin profile exists in the `users` collection.

---

## 3. Data Migration Commands

Use these commands to clean up and normalize historical data. These scripts are designed to be "Idempotent" (safe to run multiple times).

### Priority Normalization
```bash
npm run db:migrate-priority
```
*   **Action**: Scans all Campaigns and Appeals.
*   **Result**: Sets missing `priority` fields to "Medium" to ensure correct dashboard sorting.

### Beneficiary Status Normalization
```bash
npm run db:migrate-beneficiary-status
```
*   **Action**: Deep scans the Master Registry and all Project Sub-collections.
*   **Result**: Defaults missing `status` fields to "Pending" for consistent Task Center alerts.

### Donation Goal Hardening
```bash
npm run db:migrate-donations-goal
```
*   **Action**: Scans every verified donation record.
*   **Result**: Ensures the `forFundraising` flag is explicitly set, preventing errors in progress bar calculations.

### Legacy Donation Mapping
```bash
npm run db:migrate-donations
```
*   **Action**: Converts old-format donations into the modern `linkSplit` structure.
*   **Result**: Allows a single donation to be split across multiple initiatives.

---

## 4. File & Settings Migration

### `npm run db:migrate-settings`
**Purpose**: Synchronizes branding and payment files with the new secure folder structure.
*   Moves logo and QR code files to their permanent paths in Storage.
*   Updates the corresponding Firestore URLs.

---

## 5. System Health & Structure Checks

### `npm run db:check-structure`
**Purpose**: A read-only audit of the database.
*   Lists all active collections and root storage folders.
*   Useful for verifying a successful migration or seed.

---

## 6. Emergency Data Reset (Destructive)

### `npm run db:erase`
**WARNING**: This action is **permanent and irreversible**.
*   Deletes all campaigns, leads, beneficiaries, and donations.
*   Deletes all non-admin user accounts.
*   Purges the entire Cloud Storage bucket.
*   **Usage**: Only used during the transition from testing to a clean production launch.

---
[**◄ Back to Index**](./README.md)