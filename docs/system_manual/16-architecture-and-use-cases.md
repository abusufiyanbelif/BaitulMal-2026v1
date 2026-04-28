# 16. Architecture, Flow, and Module Use Cases

This document provides a comprehensive overview of the BaitulMal system architecture, database mapping, approval workflows, and detailed user guides for each core module.

## System Architecture

BaitulMal is built using a modern, serverless architecture optimized for scalability, security, and real-time updates.

*   **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui.
*   **Backend**: Firebase Services (Firestore, Storage, Authentication).
*   **AI Integration**: Genkit and Google Gemini for automated data extraction (e.g., OCR on Aadhaar cards) and intelligent workflows.
*   **State Management**: React Context, custom hooks (`use-doc.tsx`, `use-collection.tsx`) for real-time Firebase syncing.

### Core Modules & Data Flow

1.  **Donors & Donations (Fund Inflow)**
    *   **Donors**: Registered benefactors. Profiles track lifetime contributions.
    *   **Donations**: Financial contributions. Can be tracked generally or mapped to specific Causes/Campaigns.
2.  **Beneficiaries & Leads (Need Identification)**
    *   **Leads**: Initial requests for help. Evaluated by field workers (Surveyors).
    *   **Beneficiaries**: Approved individuals requiring assistance.
3.  **Campaigns (Fund Allocation)**
    *   **Campaigns**: Targeted fundraising or distribution initiatives (e.g., Ramadan Ration, Medical Aid).
    *   **Allocation**: Linking Donations to Campaigns, and allocating Campaign resources to Beneficiaries.

---

## Data Structure & Storage Flow

### Firestore Collections Mapping
*   `users`: Staff members (Admins, Surveyors). Manages role-based access.
*   `donors`: Registered donors.
*   `beneficiaries`: Approved aid recipients. Contains nested sub-collections or arrays for specific aid types (e.g., `educational`, `medical`).
*   `leads`: Pending requests for aid. Once verified, a lead can be migrated to a `beneficiary`.
*   `campaigns`: Active fundraising or distribution drives.
*   `donations`: Individual transaction records.
*   `notifications`: Real-time alerts for staff and donors.
*   `documents`: Metadata for uploaded files (Aadhaar cards, receipts).

### Cloud Storage Flow
All media and sensitive documents are stored in Firebase Cloud Storage.
*   **Path Structure**: `/{collection}/{documentId}/{fileCategory}/{filename}`
*   **Security**: Rules ensure only Admins or the owner of the document can read/write.
*   **OCR Pipeline**: Uploaded documents (like Aadhaar) trigger a Genkit Server Action that extracts text and updates the respective Firestore document automatically.

---

## Multi-Level Approval Workflows

The system employs strict role-based approval logic to ensure financial integrity and data accuracy.

### 1. Lead Verification Flow
*   **Creation**: A User creates a Lead. Status: `Pending`.
*   **Survey**: A Surveyor conducts a field visit and updates the Lead with remarks and evidence.
*   **Approval**: A system Admin reviews the survey.
    *   If `Approved`: The Lead is converted into a full `Beneficiary` record.
    *   If `Rejected`: The Lead is closed.

### 2. Campaign Allocation Approval (Role-Restricted)
*   When allocating funds from a Campaign to a Beneficiary, the action must be verified.
*   **Authorized Verifiers**: The system allows designating specific Admins as "Authorized Verifiers" in the Settings module.
*   **Execution**: Only an Authorized Verifier can approve a financial allocation. Once approved, the funds are deducted from the Campaign's `raised` pool and added to the Beneficiary's received log.

---

## Module User Guides & Use Cases

### 1. Identity & Team Center (User Management)
*   **Use Case**: Managing staff access and resolving fragmented identities.
*   **Flow**:
    1. Navigate to the Users page.
    2. **Registry**: Add/Edit staff roles (Admin vs User).
    3. **Resolution Center**: Use this to fix identity collisions. If a user exists as a Staff member, a Donor, and a Beneficiary, the system highlights the gap. Click **Mirror** to auto-create linked profiles across modules without data duplication.

### 2. Donor Portal
*   **Use Case**: Donors track their contributions and view receipts.
*   **Flow**:
    1. Donor logs in via OTP/Email.
    2. Views historical donations.
    3. Clicks on a specific donation to download an official PDF/PNG receipt.

### 3. Beneficiary Management
*   **Use Case**: Tracking aid distributed to individuals over time.
*   **Flow**:
    1. Open a Beneficiary profile.
    2. Navigate to the **Financial Sync** tab to manually recalculate historical allocations if data drift occurs.
    3. Update specific needs (e.g., uploading medical bills under the Medical tab).

### 4. Settings & Integrations
*   **Use Case**: Configuring system-wide parameters.
*   **Flow**:
    1. **Role Verification**: Assign which admins can approve campaigns.
    2. **Notifications**: Setup Telegram Group Chat IDs for automated bot alerts.

---

[**◄ Back to Index**](../README.md)
