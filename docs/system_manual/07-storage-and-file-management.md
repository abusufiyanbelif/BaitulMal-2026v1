# 7. Storage & File Management

This guide explains how files are organized in Firebase Storage for the DocuExtract application. Understanding this structure is important for managing files manually and for debugging any storage-related issues.

## Table of Contents

-   [Folder Structure Philosophy](#folder-structure-philosophy)
-   [Detailed Folder Layout](#detailed-folder-layout)
-   [A Note on Migration](#a-note-on-migration)

## Folder Structure Philosophy

The storage bucket is organized hierarchically, following a simple principle: **all files related to a specific document in Firestore are stored in a folder named after that document's ID.**

This approach provides several key benefits:

*   **Security**: It allows us to write clear and efficient Firebase Storage Security Rules. For example, we can easily write a rule that says "a user can only access files inside the `users/{userId}` folder that matches their own user ID".
*   **Organization**: It keeps the storage bucket clean and makes it easy to find files related to a specific campaign, lead, or user.
*   **Data Integrity**: When a campaign or user is deleted, it's straightforward to locate and delete their associated folder in Storage, preventing orphaned files.

## Detailed Folder Layout

Here is a breakdown of the folder structure used by the application:

### `/settings/`

*   `/settings/logo`: Stores the main application logo uploaded in the App Settings.
*   `/settings/payment_qr`: Stores the UPI/Payment QR code.
    *   **Permissions**: Publicly readable, but only writable by Admins.

### `/users/{userId}/`

This folder contains all files specific to a single user.

*   `/users/{userId}/id_proof.png`: Stores the ID proof document for the user profile.
    *   **Permissions**: Only readable and writable by the user with the matching `{userId}` or an Admin.

### `/campaigns/{campaignId}/`

*   `/campaigns/{campaignId}/background.png`: The header image for the campaign.
*   `/campaigns/{campaignId}/documents/{documentName}`: Stores any additional documents uploaded for the campaign.
    *   **Permissions**: Read access is granted if the campaign is "Published" or if the user has read permissions. Write access is for Admins or users with update permissions for campaigns.

### `/leads/{leadId}/`

*   `/leads/{leadId}/background.png`: The header image for the lead.
*   `/leads/{leadId}/documents/{documentName}`: Stores any additional documents uploaded for the lead.
    *   **Permissions**: Similar to campaigns, access is tied to the lead's visibility and user permissions.

### `/beneficiaries/{beneficiaryId}/`

*   `/beneficiaries/{beneficiaryId}/{timestamp}.png`: Stores the ID proof document for a beneficiary from the master list. The timestamp ensures file name uniqueness if it's re-uploaded.
    *   **Permissions**: Writable by any signed-in user (when adding a beneficiary), but read access is restricted to users with beneficiary read permissions.

### `/donations/{donationId}/`

*   `/donations/{donationId}/{transactionId}.png`: Stores the payment screenshot for a specific transaction within a donation.
    *   **Permissions**: Writable by the user who uploaded it. Read access is restricted to users with donation read permissions.

## A Note on Migration

You asked an excellent question about migrating existing files.

After a thorough review, I can confirm that the application's code has been consistently using this structured approach for all file uploads from the beginning. Header images for campaigns and leads, for example, have always been saved to their respective `/{id}/background.png` paths.

Because this organized structure is already in place for all existing data, **no migration script is needed** to move or rename files. The logic is backward-compatible and will work correctly for both old and new records.

---

[**◄ Back to Index**](../README.md)
