# 8. Database Schema & Data Structure

This document provides a detailed technical breakdown of the Firestore database structure used by the Organization.

## 1. Core Collections

### `users`
Stores all staff and volunteer profiles.
- **Fields**:
  - `id`: (string) Firebase Auth UID.
  - `name`: (string) Full legal name.
  - `email`: (string) Primary contact email.
  - `phone`: (string) 10-digit mobile number.
  - `loginId`: (string) Unique ID for sign-in.
  - `userKey`: (string) System-generated ID.
  - `role`: (string) 'Admin' or 'User'.
  - `status`: (string) 'Active' or 'Inactive'.
  - `permissions`: (object) Granular module access flags.
  - `organizationGroup`: (string) 'founder', 'finance', 'member', etc.
  - `organizationRole`: (string) Institutional title (e.g., 'Treasurer').
  - `idProofUrl`: (string) Link to ID document in Storage.

### `donors`
The primary registry of community contributors.
- **Fields**:
  - `name`: (string) Donor's full name.
  - `phone`: (string) Primary identifier for linking.
  - `upiIds`: (array) Known digital payment handles.
  - `bankDetails`: (array) Verified account info for transfers.
  - `status`: (string) 'Active' or 'Inactive'.
  - `notes`: (string) Internal history or preferences.

### `donations`
Financial records for every contribution.
- **Fields**:
  - `donorName`: (string) Recorded name.
  - `donorPhone`: (string) Recorded phone.
  - `donorId`: (string|null) Reference to a verified `donors` document.
  - `amount`: (number) Total value of the donation.
  - `typeSplit`: (array) Breakdown by category (Zakat, Sadaqah, etc.).
    - `category`: (string) Type of fund.
    - `amount`: (number) Value for this category.
    - `forFundraising`: (boolean) Does this count toward project goals?
  - `linkSplit`: (array) Allocation to specific initiatives.
    - `linkId`: (string) ID of Campaign or Lead.
    - `linkType`: (string) 'campaign' or 'lead'.
    - `amount`: (number) Value allocated.
  - `status`: (string) 'Verified', 'Pending', or 'Canceled'.
  - `transactions`: (array) Individual payment events with proof.

### `beneficiaries` (Master Registry)
The definitive list of verified aid recipients.
- **Fields**:
  - `name`: (string) Full name.
  - `isEligibleForZakat`: (boolean) Shariah-compliant eligibility flag.
  - `status`: (string) Master verification status (Verified, Hold, etc.).
  - `members`: (number) Total family size.
  - `idNumber`: (string) Aadhaar or government ID.

## 2. Initiative Collections

### `campaigns` & `leads`
Shared structure for community projects and individual cases.
- **Key Fields**:
  - `name`: (string) Project title.
  - `targetAmount`: (number) Financial goal.
  - `status`: (string) 'Active', 'Upcoming', 'Completed'.
  - `priority`: (string) 'Urgent', 'High', 'Medium', 'Low'.
  - `publicVisibility`: (string) 'Published', 'Hold', 'Ready'.
  - `itemCategories`: (array) Breakdown of required items and costs.
- **Sub-collections**:
  - `beneficiaries`: Specific list of recipients for this project. Includes `kitAmount` and `disbursementStatus`.

## 3. Configuration & Metadata

### `settings`
- `branding`: Name, Logo URL, Hero content, component visibility.
- `payment`: Bank details, UPI ID, QR Code URL, registration info.
- `guidance`: Directory of external hospitals and NGOs.
- `donationInfo`: Educational content for charity types.

---
[**◄ Back to Index**](./README.md)