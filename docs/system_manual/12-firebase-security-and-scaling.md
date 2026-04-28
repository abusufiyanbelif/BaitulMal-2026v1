# 12. Firebase Security & Scaling

This document explains how the Organization's cloud resources are secured and how the system handles large datasets.

## 1. Security Rules Architecture

### Firestore Rules (`firestore.rules`)
The database uses a "Locked by Default" policy. Access is granted based on:
- **Authentication**: `request.auth != null`
- **Role-Based Access (RBAC)**: Rules read the user's document in `/users/{uid}` to verify permissions (e.g., `hasPermission('campaigns', 'read')`).
- **Identity Matching**: Users can always read and update their own profile (`request.auth.uid == userId`).
- **Public Access**: Specific paths like `settings/branding` and `settings/payment` are marked as `allow read: if true` to support guest visitors.

### Storage Rules (`storage.rules`)
Files are secured based on their path structure:
- **Member ID Proofs**: `/users/{uid}/id_proof.png` is restricted to the owner and Admins.
- **Campaign Documents**: Access is granted if the user is a verified member or if the campaign is `Published`.
- **Public Visibility**: The system checks the `isPublic` flag on documents within Firestore before allowing a download URL to be rendered in the UI.

## 2. Indexing Strategy
To support the complex filtering in the **Donation Registry** and **Task Center**, the following composite indexes are required:
- `donations`: `status` (ASC) + `donationDate` (DESC)
- `beneficiaries`: `status` (ASC) + `name` (ASC)
- `campaigns`: `publicVisibility` (ASC) + `priority` (DESC)

## 3. Scaling Considerations
- **Non-Blocking Writes**: The UI uses optimistic updates. When a user saves a donation, it is immediately added to the local list while the background sync completes.
- **Batch Processing**: Actions like `Bulk Status Update` use Firestore Batches (up to 500 docs per commit) to ensure atomic consistency.
- **Pagination**: The registries use local filtering and sorting for the MVP. As the database grows beyond 5,000 records, server-side pagination using `startAfter()` is recommended.

---
[**◄ Back to Index**](./README.md)
