# 📘 User Guide: /beneficiaries
    
**Build Version:** `v2026.10.10.1`
**Last Updated:** 10/10/2026
**Internal Route:** `/beneficiaries`

---

## 🎯 Purpose
Centralized Beneficiary Registry for managing, verifying, and tracking individuals and families supported across all organization initiatives and campaigns.

## 📋 Primary Use Cases
- View and search master records of all supported individuals.
- Access the **Master Registry** tab for unified search, verification status updates, Zakat eligibility management, and CSV export/import.
- Switch to the **Repeat Beneficiaries Directory** tab to inspect recipients receiving recurring assistance across multiple causes, viewing total funding allocations and initiative counts.
- Export filtered beneficiary registries for auditing and batch import updated records.

## 🧪 In-Place Navigation & Tab Architecture
- Default URL: `http://localhost:3000/beneficiaries`
- In-place Tab Switcher:
  - **Master Registry**: Unified table with verification badges, Zakat eligibility, contact information, and referral tracking.
  - **Repeat Beneficiaries Directory**: Subcollection-queried directory displaying recurring aid recipients, total disbursed funding, and cause breakdowns.
- Clean URL Guarantee: Switching tabs toggles UI state in-place without appending query strings (`?tab=repeat` is omitted).

## 🏗️ Data Architecture (Firestore)
- Root Collection: `beneficiaries`
- Subcollections (for Repeat Beneficiary resolution):
  - `campaigns/{campaignId}/beneficiaries`
  - `leads/{leadId}/beneficiaries`
- Resolves subcollection records via campaign/lead parents to prevent client-side `collectionGroup` root permission errors.

## ⌨️ Fields & Data Mapping
- **Master Registry Fields**: Identity Name, Phone Number, Verification Status (`Verified`, `Pending`, `Hold`, `Need More Details`), Zakat Eligibility (`Eligible`, `Hold`), Disbursement Category, Referral Source, Added Date.
- **Repeat Beneficiary Fields**: Multi-Cause Badge (`Repeat (X Causes)`), Total Initiatives Supported, Cumulative Aid Amount (₹), Cumulative Zakat Amount (₹), Top Recurring Cause.

## ⚡ Interactive Actions & Controls
- **Tab Switcher**: Toggle between `Master Registry` and `Repeat Beneficiaries Directory`.
- **Search & Filters**: Real-time name, contact, and address search; status filters; Zakat filters; referral filters; date range pickers.
- **Batch Actions**: Bulk verification status updates and bulk Zakat eligibility toggles.
- **Export / Import**: CSV export of master registry and batch CSV import dialog.

## 🛡️ Security & Access
Restricted to authenticated Admin and Staff users with `permissions.beneficiaries.read` permission. Batch updates and deletions require `permissions.beneficiaries.update` / `delete`.