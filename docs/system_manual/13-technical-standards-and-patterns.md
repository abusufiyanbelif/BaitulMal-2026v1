# 13. Technical Standards & Patterns

This guide codifies the development standards and UI patterns used to maintain the Organization's professional digital presence.

## 1. Typography: The Title Case Standard
To maintain a sober and institutional look, we avoid all-caps text.
- **Rule**: All headings, labels, and buttons must use **Title Case**.
- **Correct**: "Save Contribution Record", "Identity Verification"
- **Incorrect**: "SAVE RECORD", "IDENTITY VERIFICATION"

## 2. Language: Simple Charitable English
We replace complex clinical or technical terms with community-focused language.
- **Procurement** -> "Purchasing" or "Item Lists"
- **Artifacts** -> "ID Documents" or "Evidence"
- **Vetting** -> "Verification"
- **Institutional** -> "Organization" or "Team"

## 3. The "Non-Blocking" Pattern
To ensure the app feels fast, we avoid using `await` on simple Firestore writes.
- **Pattern**: Initiate the write (`setDoc`, `updateDoc`) and immediately proceed. Use `.catch()` to handle errors asynchronously.
- **Benefit**: The user sees the change instantly due to Firestore's local cache.

## 4. Error Emitter System
We use a centralized `errorEmitter` to catch and surface security denials.
- **How it works**: If a Security Rule blocks an action, the `.catch()` block emits a `FirestorePermissionError`.
- **UI Feedback**: A global listener catches these and throws a Next.js error, ensuring the developer (or agent) can see the exact path and method that was denied.

## 5. Mobile Alignment (The ScrollArea Hub)
Every table or wide component must be wrapped in a `ScrollArea` with an explicit `min-width`.
- **Standard**: Ensure that smartphone users can scroll horizontally to see financial totals or action buttons without the page layout breaking.

---
[**◄ Back to Index**](./README.md)
