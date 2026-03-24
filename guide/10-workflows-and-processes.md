# 10. Core Workflows & Processes

The Organization operates through several critical standard operating procedures (SOPs) digitized within the application.

## 1. Donation Vetting Workflow
1.  **Entry**: A staff member records a contribution (Cash or Online).
2.  **Evidence**: A screenshot of the digital receipt or a photo of the cash voucher is uploaded.
3.  **Vetting**: A Finance Admin reviews the `Pending` donation.
4.  **Verification**: Once confirmed in the bank statement, the status is set to `Verified`.
5.  **Impact**: The funds immediately update the relevant project's progress bar.

## 2. Case Verification (Leads) Workflow
1.  **Submission**: A community request is created as a "Lead".
2.  **Documentation**: Medical reports or academic transcripts are uploaded.
3.  **AI Analysis**: The **Smart Scanner** extracts key findings (e.g., disease stage or marks obtained).
4.  **Priority Assignment**: The team sets a priority (e.g., 'Urgent' for immediate surgery).
5.  **Activation**: Once verified, `publicVisibility` is set to `Published` to begin community fundraising.

## 3. Distribution Workflow (Ration/Relief)
1.  **Selection**: Beneficiaries are selected from the **Master Registry** and linked to a project.
2.  **Allocation**: Based on family size, the system assigns a kit value (e.g., ₹2,500).
3.  **Vouching**: A list is exported for field volunteers.
4.  **Completion**: After the event, the status is bulk-updated to `Given` in the project sub-collection.

## 4. Donor Resolution Hub
1.  **Scanning**: The system identifies contributions from unrecognized phone numbers.
2.  **Matching**: Staff search the existing registry for matches.
3.  **Consolidation**: The donation is linked to a `donorId`, merging history into a single profile.

---
[**◄ Back to Index**](./README.md)