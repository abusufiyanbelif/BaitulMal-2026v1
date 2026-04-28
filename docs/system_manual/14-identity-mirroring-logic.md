# 14. Identity Mirroring Logic

This document details the unique "Member-as-Donor" logic that ensures staff contributions are tracked accurately.

## 1. The Mirroring Pattern
Every Organization User exists in two places:
1.  **`users` Collection**: Stores their account, role, and system permissions.
2.  **`donors` Collection**: Stores their identity as a community contributor.

### Automatic Mirroring
When a new user is created via the **Member Registry**, the `createUserAuthAction` also creates a mirrored document in the `donors` collection with the same `id`.

## 2. The Lookup Map (`user_lookups`)
To support sign-in by Login ID or Phone, we maintain a public mapping:
- **Path**: `user_lookups/{identifier}`
- **Value**: `{ email: '...', userKey: '...' }`
- **Logic**: This allows the Login page to "discover" the real Firebase Auth email without exposing the entire user profile to the public.

## 3. Unlinked Donation Resolution
When a contribution is recorded from an unrecognized phone number:
1.  It is saved as an "Unlinked" donation (`donorId: null`).
2.  The **Resolution Hub** scans the `donors` registry for a matching phone.
3.  Staff can then "Link" the donation, which updates the `donorId` field, instantly merging the contribution into that donor's lifetime history.

---
[**◄ Back to Index**](./README.md)
