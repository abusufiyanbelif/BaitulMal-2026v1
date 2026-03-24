# 9. Page Mapping & Business Logic

This document details how UI components interact with the database and the logic governing automated calculations.

## 1. Membership & Dashboard
- **Login Page**:
  - Checks `user_lookups` to find the email associated with a Login ID or Phone.
  - Verifies `status === 'Active'` before allowing entry.
- **Admin Dashboard**:
  - Dynamic card grid filtered by user `permissions`.
  - Statistics cards use the `usePublicData` hook to show aggregate organizational impact.

## 2. The Campaign & Lead Hubs
- **Management View**:
  - Divided into **Published** and **Internal Hub** sections.
  - Automatic sorting by **Priority Weight** (Urgent=4, High=3, Medium=2, Low=1).
- **Summary Editor**:
  - **Logic**: When an image is uploaded, it is resized via `Resizer` before being stored in `campaigns/{id}/background.png`.
  - **Documents**: Multiple files can be attached. Each has an `isPublic` flag that controls visibility on guest-facing pages.
- **Item List Manager**:
  - **Master Price List**: A dedicated category where unit prices are defined.
  - **Category Sync**: When a unit price changes in the "Master", all family categories (Small, Medium, Large) automatically update their total costs based on quantity multipliers.

## 3. Donation & Donor Logic
- **Identity Resolution (The Resolver Hub)**:
  - **Process**: Unlinked donations (missing `donorId`) are compared against the `donors` registry via phone number.
  - **Auto-Mirroring**: When a new Organization User is created, a mirrored profile is generated in the `donors` collection to ensure staff contributions are tracked.
- **Zakat Goal Progress**:
  - **Calculation**: Only `Verified` donations where `forFundraising === true` impact the progress bars.
  - **Zakat Specifics**: Zakat often covers specific beneficiary allocations. The logic subtracts "Allocated Zakat" from "Goal Progress" to ensure no double-counting between general funds and reserved aid.

## 4. Beneficiary Vetting
- **Registry Filter**:
  - Advanced filtering by **Referral Source**, **Verification Status**, and **Date Range**.
- **Batch Sync**:
  - Staff can select multiple recipients and bulk-update statuses (e.g., marking 50 families as "Given" after a distribution event).

---
[**◄ Back to Index**](./README.md)