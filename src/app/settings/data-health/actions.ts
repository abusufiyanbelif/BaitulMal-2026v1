'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { bulkRecalculateInitiativeTotalsAction } from '../../donations/actions';

const ADMIN_SDK_ERROR_MESSAGE = 'Operational Failure: Administrative Services Unavailable.';

export interface DataIssue {
    id: string;
    collection: string;
    docId: string;
    field: string;
    module: string;
    severity: 'critical' | 'warning' | 'info';
    issueType: 'missing_field' | 'wrong_value' | 'orphaned_link' | 'stale_status' | 'calculation_drift';
    currentValue: any;
    suggestedValue: any;
    description: string;
    canAutoFix: boolean;
}

export interface ScanResult {
    success: boolean;
    message: string;
    issues: DataIssue[];
    scannedCounts: Record<string, number>;
}

/**
 * Comprehensive data health scan across all Firestore collections.
 * Checks for:
 * - Donations: missing typeSplit, missing donorId placeholder, missing linkSplit, wrong status defaults
 * - Campaigns: missing collectedAmount, wrong authenticityStatus defaults
 * - Leads: missing collectedAmount, wrong authenticityStatus defaults, missing requiredAmount
 * - Beneficiaries: missing status defaults, missing verificationStatus
 * - Donors: missing phones[] array, missing status defaults
 * - Settings: missing verificationMode (migration from legacy boolean)
 */
export async function scanDataHealthAction(): Promise<ScanResult> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, issues: [], scannedCounts: {} };

    const issues: DataIssue[] = [];
    const scannedCounts: Record<string, number> = {};

    try {
        // ============================================================
        // 1. DONATIONS scan
        // ============================================================
        const donationsSnap = await adminDb.collection('donations').get();
        scannedCounts['donations'] = donationsSnap.size;

        donationsSnap.docs.forEach((doc: any) => {
            const d = doc.data();

            // typeSplit missing or empty — required for category calculations
            if (!d.typeSplit || d.typeSplit.length === 0) {
                issues.push({
                    id: `donations_${doc.id}_typeSplit`,
                    collection: 'donations', docId: doc.id,
                    field: 'typeSplit', module: 'Donations',
                    severity: d.type ? 'warning' : 'critical',
                    issueType: 'missing_field',
                    currentValue: d.typeSplit ?? undefined,
                    suggestedValue: d.type && d.amount ? [{ category: d.type, amount: d.amount, forFundraising: false }] : [],
                    description: `Donation record has empty/missing typeSplit. Legacy type="${d.type}" can be migrated.`,
                    canAutoFix: !!d.type && !!d.amount
                });
            }

            // donorId field missing entirely (should be null, not undefined)
            if (d.donorId === undefined) {
                issues.push({
                    id: `donations_${doc.id}_donorId`,
                    collection: 'donations', docId: doc.id,
                    field: 'donorId', module: 'Donations',
                    severity: 'info',
                    issueType: 'missing_field',
                    currentValue: undefined,
                    suggestedValue: null,
                    description: `donorId field is undefined (not null). This breaks identity resolution queries.`,
                    canAutoFix: true
                });
            }

            // linkSplit missing — should exist for all donations for initiative tracking
            if (!d.linkSplit || d.linkSplit.length === 0) {
                issues.push({
                    id: `donations_${doc.id}_linkSplit`,
                    collection: 'donations', docId: doc.id,
                    field: 'linkSplit', module: 'Donations',
                    severity: 'info',
                    issueType: 'missing_field',
                    currentValue: d.linkSplit ?? undefined,
                    suggestedValue: [{ linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general', amount: d.amount || 0 }],
                    description: `Donation has no initiative link. Will be assigned to "Unallocated" general fund.`,
                    canAutoFix: true
                });
            }

            // status field missing
            if (!d.status) {
                issues.push({
                    id: `donations_${doc.id}_status`,
                    collection: 'donations', docId: doc.id,
                    field: 'status', module: 'Donations',
                    severity: 'critical',
                    issueType: 'missing_field',
                    currentValue: d.status,
                    suggestedValue: 'Pending',
                    description: `Donation record has no status field. Defaulting to Pending.`,
                    canAutoFix: true
                });
            }

            // uploadedById missing
            if (!d.uploadedById) {
                issues.push({
                    id: `donations_${doc.id}_uploadedById`,
                    collection: 'donations', docId: doc.id,
                    field: 'uploadedById', module: 'Donations',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.uploadedById,
                    suggestedValue: 'system',
                    description: `Donation record is missing uploadedById (audit trail broken).`,
                    canAutoFix: true
                });
            }
        });

        // ============================================================
        // 2. CAMPAIGNS scan
        // ============================================================
        const campaignsSnap = await adminDb.collection('campaigns').get();
        scannedCounts['campaigns'] = campaignsSnap.size;

        campaignsSnap.docs.forEach((doc: any) => {
            const d = doc.data();

            // collectedAmount missing
            if (d.collectedAmount === undefined || d.collectedAmount === null) {
                issues.push({
                    id: `campaigns_${doc.id}_collectedAmount`,
                    collection: 'campaigns', docId: doc.id,
                    field: 'collectedAmount', module: 'Campaigns',
                    severity: 'critical',
                    issueType: 'missing_field',
                    currentValue: d.collectedAmount,
                    suggestedValue: 0,
                    description: `Campaign missing collectedAmount. Financial progress bars will show 0% incorrectly.`,
                    canAutoFix: true
                });
            }

            // authenticityStatus missing
            if (!d.authenticityStatus) {
                issues.push({
                    id: `campaigns_${doc.id}_authenticityStatus`,
                    collection: 'campaigns', docId: doc.id,
                    field: 'authenticityStatus', module: 'Campaigns',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.authenticityStatus,
                    suggestedValue: 'Pending Verification',
                    description: `Campaign missing authenticityStatus. Authenticity pipeline won't track this record.`,
                    canAutoFix: true
                });
            }

            // publicVisibility missing
            if (!d.publicVisibility) {
                issues.push({
                    id: `campaigns_${doc.id}_publicVisibility`,
                    collection: 'campaigns', docId: doc.id,
                    field: 'publicVisibility', module: 'Campaigns',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.publicVisibility,
                    suggestedValue: 'Hold',
                    description: `Campaign missing publicVisibility field. Public display logic may break.`,
                    canAutoFix: true
                });
            }

            // status check — ensure valid values
            const validStatuses = ['Upcoming', 'Active', 'Completed'];
            if (d.status && !validStatuses.includes(d.status)) {
                issues.push({
                    id: `campaigns_${doc.id}_status_invalid`,
                    collection: 'campaigns', docId: doc.id,
                    field: 'status', module: 'Campaigns',
                    severity: 'critical',
                    issueType: 'wrong_value',
                    currentValue: d.status,
                    suggestedValue: 'Upcoming',
                    description: `Campaign has invalid status value "${d.status}". Must be one of: ${validStatuses.join(', ')}.`,
                    canAutoFix: false
                });
            }

            // itemCategories missing
            if (d.itemCategories === undefined) {
                issues.push({
                    id: `campaigns_${doc.id}_itemCategories`,
                    collection: 'campaigns', docId: doc.id,
                    field: 'itemCategories', module: 'Campaigns',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.itemCategories,
                    suggestedValue: [],
                    description: `Campaign missing itemCategories array. Beneficiary linking will fail.`,
                    canAutoFix: true
                });
            }
        });

        // ============================================================
        // 3. LEADS scan
        // ============================================================
        const leadsSnap = await adminDb.collection('leads').get();
        scannedCounts['leads'] = leadsSnap.size;

        leadsSnap.docs.forEach((doc: any) => {
            const d = doc.data();

            // collectedAmount missing
            if (d.collectedAmount === undefined || d.collectedAmount === null) {
                issues.push({
                    id: `leads_${doc.id}_collectedAmount`,
                    collection: 'leads', docId: doc.id,
                    field: 'collectedAmount', module: 'Leads',
                    severity: 'critical',
                    issueType: 'missing_field',
                    currentValue: d.collectedAmount,
                    suggestedValue: 0,
                    description: `Lead missing collectedAmount. Financial progress bars will show 0% incorrectly.`,
                    canAutoFix: true
                });
            }

            // requiredAmount missing for "Completed" leads
            if (d.status === 'Completed' && (d.requiredAmount === undefined || d.requiredAmount === null)) {
                issues.push({
                    id: `leads_${doc.id}_requiredAmount`,
                    collection: 'leads', docId: doc.id,
                    field: 'requiredAmount', module: 'Leads',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.requiredAmount,
                    suggestedValue: d.targetAmount || 0,
                    description: `Completed lead has no requiredAmount. Migrating from targetAmount.`,
                    canAutoFix: true
                });
            }

            // authenticityStatus missing
            if (!d.authenticityStatus) {
                issues.push({
                    id: `leads_${doc.id}_authenticityStatus`,
                    collection: 'leads', docId: doc.id,
                    field: 'authenticityStatus', module: 'Leads',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.authenticityStatus,
                    suggestedValue: d.status === 'Completed' ? 'Verified' : 'Pending Verification',
                    description: `Lead missing authenticityStatus. Defaulting based on lead status.`,
                    canAutoFix: true
                });
            }

            // publicVisibility missing
            if (!d.publicVisibility) {
                issues.push({
                    id: `leads_${doc.id}_publicVisibility`,
                    collection: 'leads', docId: doc.id,
                    field: 'publicVisibility', module: 'Leads',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.publicVisibility,
                    suggestedValue: 'Hold',
                    description: `Lead missing publicVisibility field. Public display logic may break.`,
                    canAutoFix: true
                });
            }

            // itemCategories missing
            if (d.itemCategories === undefined) {
                issues.push({
                    id: `leads_${doc.id}_itemCategories`,
                    collection: 'leads', docId: doc.id,
                    field: 'itemCategories', module: 'Leads',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.itemCategories,
                    suggestedValue: [],
                    description: `Lead missing itemCategories array.`,
                    canAutoFix: true
                });
            }
        });

        // ============================================================
        // 4. BENEFICIARIES (master collection) scan
        // ============================================================
        const beneficiariesSnap = await adminDb.collection('beneficiaries').get();
        scannedCounts['beneficiaries'] = beneficiariesSnap.size;

        beneficiariesSnap.docs.forEach((doc: any) => {
            const d = doc.data();

            // status missing — must have a default
            if (!d.status) {
                issues.push({
                    id: `beneficiaries_${doc.id}_status`,
                    collection: 'beneficiaries', docId: doc.id,
                    field: 'status', module: 'Beneficiaries',
                    severity: 'critical',
                    issueType: 'missing_field',
                    currentValue: d.status,
                    suggestedValue: 'Pending',
                    description: `Beneficiary has no status. Verification pipeline will skip this record.`,
                    canAutoFix: true
                });
            }

            // addedDate missing
            if (!d.addedDate) {
                const fallback = d.createdAt?.toDate?.()?.toISOString?.()?.split?.('T')?.[0] || new Date().toISOString().split('T')[0];
                issues.push({
                    id: `beneficiaries_${doc.id}_addedDate`,
                    collection: 'beneficiaries', docId: doc.id,
                    field: 'addedDate', module: 'Beneficiaries',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.addedDate,
                    suggestedValue: fallback,
                    description: `Beneficiary missing addedDate. Will use createdAt timestamp as fallback.`,
                    canAutoFix: true
                });
            }

            // kitAmount missing/undefined (should default to 0)
            if (d.kitAmount === undefined) {
                issues.push({
                    id: `beneficiaries_${doc.id}_kitAmount`,
                    collection: 'beneficiaries', docId: doc.id,
                    field: 'kitAmount', module: 'Beneficiaries',
                    severity: 'info',
                    issueType: 'missing_field',
                    currentValue: undefined,
                    suggestedValue: 0,
                    description: `Beneficiary missing kitAmount. Goal calculations will exclude this record.`,
                    canAutoFix: true
                });
            }

            // members must be at least 1
            if (!d.members || d.members < 1) {
                issues.push({
                    id: `beneficiaries_${doc.id}_members`,
                    collection: 'beneficiaries', docId: doc.id,
                    field: 'members', module: 'Beneficiaries',
                    severity: 'warning',
                    issueType: 'wrong_value',
                    currentValue: d.members,
                    suggestedValue: 1,
                    description: `Beneficiary has invalid members count (${d.members}). Defaulting to 1.`,
                    canAutoFix: true
                });
            }
        });

        // ============================================================
        // 5. DONORS scan
        // ============================================================
        const donorsSnap = await adminDb.collection('donors').get();
        scannedCounts['donors'] = donorsSnap.size;

        donorsSnap.docs.forEach((doc: any) => {
            const d = doc.data();

            // status missing
            if (!d.status) {
                issues.push({
                    id: `donors_${doc.id}_status`,
                    collection: 'donors', docId: doc.id,
                    field: 'status', module: 'Donors',
                    severity: 'critical',
                    issueType: 'missing_field',
                    currentValue: d.status,
                    suggestedValue: 'Active',
                    description: `Donor profile has no status field. Profile may not appear in active registry.`,
                    canAutoFix: true
                });
            }

            // phones[] array missing (used for multi-identity queries)
            if (!d.phones || d.phones.length === 0) {
                issues.push({
                    id: `donors_${doc.id}_phones`,
                    collection: 'donors', docId: doc.id,
                    field: 'phones', module: 'Donors',
                    severity: 'info',
                    issueType: 'missing_field',
                    currentValue: d.phones,
                    suggestedValue: d.phone ? [d.phone] : [],
                    description: `Donor missing phones[] array. Multi-identity resolution queries will fail.`,
                    canAutoFix: !!d.phone
                });
            }

            // phone missing entirely
            if (!d.phone) {
                issues.push({
                    id: `donors_${doc.id}_phone`,
                    collection: 'donors', docId: doc.id,
                    field: 'phone', module: 'Donors',
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: d.phone,
                    suggestedValue: null,
                    description: `Donor has no primary phone. Cannot link to donations by phone.`,
                    canAutoFix: false
                });
            }
        });

        // ============================================================
        // 6. SETTINGS scan — check for legacy verificationMode migration
        // ============================================================
        const settingsCollections = [
            { doc: 'donation_config', module: 'Donation Settings' },
            { doc: 'campaign_config', module: 'Campaign Settings' },
            { doc: 'lead_config', module: 'Lead Settings' },
            { doc: 'beneficiary_config', module: 'Beneficiary Settings' },
            { doc: 'donor_config', module: 'Donor Settings' },
        ];

        scannedCounts['settings'] = settingsCollections.length;

        for (const cfg of settingsCollections) {
            const snap = await adminDb.collection('settings').doc(cfg.doc).get();
            if (snap.exists) {
                const d = snap.data()!;
                // Legacy: has isVerificationRequired but no verificationMode
                if (d.isVerificationRequired !== undefined && !d.verificationMode) {
                    issues.push({
                        id: `settings_${cfg.doc}_verificationMode`,
                        collection: 'settings', docId: cfg.doc,
                        field: 'verificationMode', module: cfg.module,
                        severity: 'warning',
                        issueType: 'missing_field',
                        currentValue: undefined,
                        suggestedValue: d.isVerificationRequired ? 'Mandatory' : 'Disabled',
                        description: `${cfg.module} uses legacy boolean verification. Needs migration to verificationMode.`,
                        canAutoFix: true
                    });
                }
            } else {
                // Config doc doesn't exist at all — needs to be seeded
                issues.push({
                    id: `settings_${cfg.doc}_missing`,
                    collection: 'settings', docId: cfg.doc,
                    field: '*', module: cfg.module,
                    severity: 'warning',
                    issueType: 'missing_field',
                    currentValue: null,
                    suggestedValue: { verificationMode: 'Disabled', isVerificationRequired: false, mandatoryFields: {} },
                    description: `${cfg.module} config document doesn't exist. Module defaults will apply.`,
                    canAutoFix: true
                });
            }
        }

        // ============================================================
        // Summary
        // ============================================================
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;

        return {
            success: true,
            message: `Scan complete. Found ${issues.length} issues (${criticalCount} critical, ${warningCount} warnings) across ${Object.values(scannedCounts).reduce((a, b) => a + b, 0)} records.`,
            issues,
            scannedCounts
        };
    } catch (error: any) {
        console.error('Data Health Scan Error:', error);
        return { success: false, message: `Scan Failed: ${error.message}`, issues: [], scannedCounts };
    }
}

/**
 * Auto-fix a batch of issues. Applies the suggestedValue to the target document.
 */
export async function fixDataIssuesAction(
    issueIds: string[],
    allIssues: DataIssue[]
): Promise<{ success: boolean; message: string; fixedCount: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, fixedCount: 0 };

    const toFix = allIssues.filter(i => issueIds.includes(i.id) && i.canAutoFix);
    if (toFix.length === 0) return { success: true, message: 'No auto-fixable issues selected.', fixedCount: 0 };

    try {
        // Group by collection + docId for batch efficiency
        const groupedUpdates: Record<string, { collection: string; docId: string; updates: Record<string, any> }> = {};

        for (const issue of toFix) {
            const key = `${issue.collection}/${issue.docId}`;
            if (!groupedUpdates[key]) {
                groupedUpdates[key] = { collection: issue.collection, docId: issue.docId, updates: {} };
            }
            if (issue.field === '*') {
                // Whole document — use set with suggested object
                Object.assign(groupedUpdates[key].updates, issue.suggestedValue);
            } else {
                groupedUpdates[key].updates[issue.field] = issue.suggestedValue;
            }
        }

        const CHUNK_SIZE = 450;
        const entries = Object.values(groupedUpdates);
        let fixedCount = 0;

        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
            const batch = adminDb.batch();
            const chunk = entries.slice(i, i + CHUNK_SIZE);
            for (const entry of chunk) {
                const ref = adminDb.collection(entry.collection).doc(entry.docId);
                // Check if it's a "missing doc" fix (entire doc doesn't exist)
                const isNewDoc = toFix.find(t => t.collection === entry.collection && t.docId === entry.docId && t.field === '*');
                if (isNewDoc) {
                    batch.set(ref, { ...entry.updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                } else {
                    batch.update(ref, { ...entry.updates, updatedAt: FieldValue.serverTimestamp() });
                }
                fixedCount++;
            }
            await batch.commit();
        }

        // Revalidate all affected paths
        revalidatePath('/donations');
        revalidatePath('/campaigns');
        revalidatePath('/leads-members');
        revalidatePath('/beneficiaries');
        revalidatePath('/donors');
        revalidatePath('/dashboard');
        revalidatePath('/settings', 'layout');

        return { success: true, message: `Successfully fixed ${fixedCount} records.`, fixedCount };
    } catch (error: any) {
        console.error('Data Fix Error:', error);
        return { success: false, message: `Fix Failed: ${error.message}`, fixedCount: 0 };
    }
}


/**
 * Recalculate all initiative collected amounts from scratch (verified donations only).
 * Now leverages the robust Zakat surplus reconciliation logic.
 */
export async function recalculateAllCollectedAmountsAction(): Promise<{ success: boolean; message: string }> {
    return await bulkRecalculateInitiativeTotalsAction();
}

export async function initializePortalCredentialsAction(): Promise<{ success: boolean; message: string; updatedDonors: number; updatedBeneficiaries: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, updatedDonors: 0, updatedBeneficiaries: 0 };

    try {
        let updatedDonors = 0;
        let updatedBeneficiaries = 0;

        const donorsSnap = await adminDb.collection('donors').get();
        const benSnap = await adminDb.collection('beneficiaries').get();

        const batch = adminDb.batch();
        let batchCount = 0;

        for (const doc of donorsSnap.docs) {
            const data = doc.data();
            if (!data.password) {
                batch.set(doc.ref, { password: 'password', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                updatedDonors++;
                batchCount++;
                if (batchCount >= 450) {
                    await batch.commit();
                    batchCount = 0;
                }
            }
        }

        for (const doc of benSnap.docs) {
            const data = doc.data();
            if (!data.password) {
                batch.set(doc.ref, { password: 'password', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                updatedBeneficiaries++;
                batchCount++;
                if (batchCount >= 450) {
                    await batch.commit();
                    batchCount = 0;
                }
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return { 
            success: true, 
            message: `Successfully initialized passwords for ${updatedDonors} Donors and ${updatedBeneficiaries} Beneficiaries.`, 
            updatedDonors, 
            updatedBeneficiaries 
        };
    } catch (e: any) {
        console.error('Portal Credentials Initialization Error:', e);
        return { success: false, message: `Initialization Failed: ${e.message}`, updatedDonors: 0, updatedBeneficiaries: 0 };
    }
}

/**
 * Migration action to backfill / re-format all existing Campaigns and Leads to standard DDMMYYYYXX Case IDs
 * and cascade link updates to linked donations and system logs.
 */
export async function migrateUseCaseIdsAction(): Promise<{
    success: boolean;
    message: string;
    migratedCampaigns: number;
    migratedLeads: number;
    updatedDonations: number;
}> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, migratedCampaigns: 0, migratedLeads: 0, updatedDonations: 0 };
    }

    try {
        let migratedCampaigns = 0;
        let migratedLeads = 0;
        let updatedDonations = 0;

        const processCollection = async (collName: 'campaigns' | 'leads') => {
            const snap = await adminDb.collection(collName).get();
            const docs: any[] = [];
            snap.forEach((doc: any) => docs.push({ id: doc.id, ref: doc.ref, ...doc.data() }));

            // Sort by creation date / start date
            docs.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.startDate || Date.now());
                const dateB = b.createdAt?.toDate?.() || new Date(b.startDate || Date.now());
                return dateA.getTime() - dateB.getTime();
            });

            // Group by DDMMYYYY
            const dateGroups: Record<string, any[]> = {};
            for (const item of docs) {
                const rawDate = item.createdAt?.toDate?.() || new Date(item.startDate || Date.now());
                const day = String(rawDate.getDate()).padStart(2, '0');
                const month = String(rawDate.getMonth() + 1).padStart(2, '0');
                const year = rawDate.getFullYear();
                const key = `${day}${month}${year}`;

                if (!dateGroups[key]) dateGroups[key] = [];
                dateGroups[key].push(item);
            }

            // Assign sequential DDMMYYYYXX
            for (const [dateKey, groupItems] of Object.entries(dateGroups)) {
                let seq = 1;
                for (const item of groupItems) {
                    const seqStr = String(seq).padStart(2, '0');
                    const generatedId = `${dateKey}${seqStr}`;
                    seq++;

                    const effectiveCaseId = item.caseId || generatedId;
                    let initiativeUpdated = false;
                    const batch = adminDb.batch();

                    // Update initiative if caseId is missing or wrong format
                    if (item.caseId !== generatedId) {
                        batch.update(item.ref, {
                            caseId: generatedId,
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                        initiativeUpdated = true;
                        if (collName === 'campaigns') migratedCampaigns++;
                        else migratedLeads++;
                    }

                    // Cascade / sync to all donations linking this item
                    const donSnap = await adminDb.collection('donations').get();
                    let donationBatchCount = 0;

                    donSnap.forEach((dDoc: any) => {
                        const dData = dDoc.data();
                        let isAffected = false;
                        let updatedLinkSplit = dData.linkSplit;

                        const isDirectMatch = dData.campaignId === item.id || 
                                              dData.leadId === item.id || 
                                              (item.caseId && (dData.campaignId === item.caseId || dData.leadId === item.caseId));

                        if (Array.isArray(dData.linkSplit)) {
                            updatedLinkSplit = dData.linkSplit.map((l: any) => {
                                if (
                                    l.linkId === item.id ||
                                    (item.caseId && (l.linkId === item.caseId || l.caseId === item.caseId)) ||
                                    l.linkId === `${collName.slice(0, -1)}_${item.id}`
                                ) {
                                    if (l.caseId !== (initiativeUpdated ? generatedId : effectiveCaseId)) {
                                        isAffected = true;
                                    }
                                    return { ...l, caseId: initiativeUpdated ? generatedId : effectiveCaseId };
                                }
                                return l;
                            });
                        }

                        if (isDirectMatch && dData.caseId !== (initiativeUpdated ? generatedId : effectiveCaseId)) {
                            isAffected = true;
                        }

                        if (isAffected) {
                            const donUpdates: any = {
                                linkSplit: updatedLinkSplit,
                                caseId: initiativeUpdated ? generatedId : effectiveCaseId,
                                updatedAt: FieldValue.serverTimestamp(),
                            };
                            batch.update(dDoc.ref, donUpdates);
                            updatedDonations++;
                            donationBatchCount++;
                        }
                    });

                    if (initiativeUpdated || donationBatchCount > 0) {
                        await batch.commit();
                    }
                }
            }
        };

        await processCollection('campaigns');
        await processCollection('leads');

        try {
            revalidatePath('/campaign-members');
            revalidatePath('/leads-members');
            revalidatePath('/donations');
            revalidatePath('/donors');
            revalidatePath('/beneficiaries');
            revalidatePath('/donor-portal/donations');
            revalidatePath('/beneficiary-portal');
            revalidatePath('/settings/data-health');
        } catch (e) {}

        return {
            success: true,
            message: `Migration & Sync completed successfully! Standardized ${migratedCampaigns} Campaigns and ${migratedLeads} Leads with ${updatedDonations} donation Case ID cross-references updated.`,
            migratedCampaigns,
            migratedLeads,
            updatedDonations,
        };
    } catch (error: any) {
        console.error('Case ID Migration Error:', error);
        return {
            success: false,
            message: `Migration Failed: ${error.message}`,
            migratedCampaigns: 0,
            migratedLeads: 0,
            updatedDonations: 0,
        };
    }
}

/**
 * Server Action for editing a Case ID and performing a cascading update.
 */
export async function updateSingleUseCaseIdAction(
    collectionName: 'campaigns' | 'leads',
    docId: string,
    oldCaseId: string | undefined,
    newCaseId: string,
    updatedBy: { id: string; name: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    const { cascadeUpdateUseCaseIdAdmin } = await import('@/lib/use-case-id');
    const result = await cascadeUpdateUseCaseIdAdmin(
        adminDb,
        collectionName,
        docId,
        oldCaseId,
        newCaseId,
        updatedBy
    );

    if (result.success) {
        // Also rename Storage folder to match new Case ID
        await renameStorageFolderAction(collectionName, docId, oldCaseId, newCaseId);

        revalidatePath('/campaign-members');
        revalidatePath('/leads-members');
        revalidatePath(`/campaign-members/${docId}/summary`);
        revalidatePath(`/leads-members/${docId}/summary`);
        revalidatePath('/donations');
        revalidatePath('/dashboard');
    }

    return { success: result.success, message: result.message };
}

/**
 * Renames Cloud Storage folders for a Campaign or Lead when its Case ID changes.
 * Moves files from legacy paths (`module/docId/` or `module/oldCaseId_docId/`) to `module/newCaseId_docId/`.
 * Updates imageUrl and documents array URLs in the target Firestore document.
 */
export async function renameStorageFolderAction(
    collectionName: 'campaigns' | 'leads',
    docId: string,
    oldCaseId: string | undefined,
    newCaseId: string
): Promise<{ success: boolean; message: string; movedFilesCount?: number }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const { getStorageFolderName } = await import('@/lib/storage-path');
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'docuextract-q8vaa.firebasestorage.app';
        const bucket = adminStorage.bucket(bucketName);
        const oldFolderName1 = `${docId}/`;
        const oldFolderName2 = oldCaseId ? `${getStorageFolderName(oldCaseId, docId)}/` : '';
        const newFolderName = `${getStorageFolderName(newCaseId, docId)}/`;
        const newPrefix = `${collectionName}/${newFolderName}`;

        let movedCount = 0;

        const moveFilesFromPrefix = async (oldPrefix: string) => {
            if (!oldPrefix || oldPrefix === newPrefix) return;
            const [files] = await bucket.getFiles({ prefix: oldPrefix });
            for (const file of files) {
                const relativePath = file.name.substring(oldPrefix.length);
                if (!relativePath) continue;
                
                const destinationPath = `${newPrefix}${relativePath}`;
                await file.copy(bucket.file(destinationPath));
                
                try {
                    await bucket.file(destinationPath).makePublic();
                } catch (e) {}

                await file.delete().catch(() => {});
                movedCount++;
            }
        };

        await moveFilesFromPrefix(`${collectionName}/${oldFolderName1}`);
        if (oldFolderName2 && oldFolderName2 !== oldFolderName1) {
            await moveFilesFromPrefix(`${collectionName}/${oldFolderName2}`);
        }

        if (movedCount > 0) {
            const docRef = adminDb.collection(collectionName).doc(docId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const data = docSnap.data() as any;
                const updatePayload: Record<string, any> = {};
                let isUpdated = false;

                const getNewUrl = (relativePath: string) => 
                    `https://storage.googleapis.com/${bucket.name}/${newPrefix}${relativePath}`;

                if (data.imageUrl) {
                    const filename = data.imageUrl.split('?')[0].split('/').pop() || 'background.png';
                    updatePayload.imageUrl = getNewUrl(decodeURIComponent(filename));
                    isUpdated = true;
                }

                if (Array.isArray(data.documents) && data.documents.length > 0) {
                    updatePayload.documents = data.documents.map((docItem: any) => {
                        if (!docItem.url) return docItem;
                        const filename = docItem.name || docItem.url.split('?')[0].split('/').pop();
                        return {
                            ...docItem,
                            url: getNewUrl(`documents/${filename}`)
                        };
                    });
                    isUpdated = true;
                }

                if (isUpdated) {
                    await docRef.update(updatePayload);
                }
            }
        }

        return { success: true, message: `Moved ${movedCount} files to storage path ${newPrefix}`, movedFilesCount: movedCount };
    } catch (e: any) {
        console.error('Storage Folder Rename Error:', e);
        return { success: false, message: `Storage rename error: ${e.message}` };
    }
}

/**
 * Server Action to rename Cloud Storage folders for a Donation when its linked Case IDs change.
 * Concatenates all linked Case IDs alphabetically: `donations/caseId1_caseId2_donationId/`.
 */
export async function renameDonationStorageFolderAction(
    donationId: string,
    oldCaseIds?: string[],
    newCaseIds?: string[]
): Promise<{ success: boolean; message: string; movedFilesCount?: number }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const { getDonationStorageFolderName } = await import('@/lib/storage-path');
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'docuextract-q8vaa.firebasestorage.app';
        const bucket = adminStorage.bucket(bucketName);

        const oldFolderName1 = `${donationId}/`;
        const oldFolderName2 = oldCaseIds && oldCaseIds.length > 0 ? `${getDonationStorageFolderName(oldCaseIds, donationId)}/` : '';
        const newFolderName = `${getDonationStorageFolderName(newCaseIds, donationId)}/`;
        const newPrefix = `donations/${newFolderName}`;

        let movedCount = 0;

        const moveFilesFromPrefix = async (oldPrefix: string) => {
            if (!oldPrefix || oldPrefix === newPrefix) return;
            const [files] = await bucket.getFiles({ prefix: oldPrefix });
            for (const file of files) {
                const relativePath = file.name.substring(oldPrefix.length);
                if (!relativePath) continue;

                const destinationPath = `${newPrefix}${relativePath}`;
                await file.copy(bucket.file(destinationPath));

                try {
                    await bucket.file(destinationPath).makePublic();
                } catch (e) {}

                await file.delete().catch(() => {});
                movedCount++;
            }
        };

        await moveFilesFromPrefix(`donations/${oldFolderName1}`);
        if (oldFolderName2 && oldFolderName2 !== oldFolderName1) {
            await moveFilesFromPrefix(`donations/${oldFolderName2}`);
        }

        if (movedCount > 0) {
            const docRef = adminDb.collection('donations').doc(donationId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const data = docSnap.data() as any;
                const updatePayload: Record<string, any> = {};
                let isUpdated = false;

                const getNewUrl = (relativePath: string) =>
                    `https://storage.googleapis.com/${bucket.name}/${newPrefix}${relativePath}`;

                if (data.paymentProofUrl) {
                    const filename = data.paymentProofUrl.split('?')[0].split('/').pop() || 'proof.png';
                    updatePayload.paymentProofUrl = getNewUrl(decodeURIComponent(filename));
                    isUpdated = true;
                }

                if (data.receiptUrl) {
                    const filename = data.receiptUrl.split('?')[0].split('/').pop() || 'receipt.png';
                    updatePayload.receiptUrl = getNewUrl(decodeURIComponent(filename));
                    isUpdated = true;
                }

                if (Array.isArray(data.transactions) && data.transactions.length > 0) {
                    updatePayload.transactions = data.transactions.map((tx: any) => {
                        if (!tx.screenshotUrl) return tx;
                        const filename = tx.screenshotUrl.split('?')[0].split('/').pop() || 'screenshot.png';
                        return {
                            ...tx,
                            screenshotUrl: getNewUrl(decodeURIComponent(filename))
                        };
                    });
                    isUpdated = true;
                }

                if (Array.isArray(data.documents) && data.documents.length > 0) {
                    updatePayload.documents = data.documents.map((docItem: any) => {
                        if (!docItem.url) return docItem;
                        const filename = docItem.name || docItem.url.split('?')[0].split('/').pop();
                        return {
                            ...docItem,
                            url: getNewUrl(`documents/${decodeURIComponent(filename)}`)
                        };
                    });
                    isUpdated = true;
                }

                if (isUpdated) {
                    await docRef.update(updatePayload);
                }
            }
        }

        return { success: true, message: `Moved ${movedCount} donation files to ${newPrefix}`, movedFilesCount: movedCount };
    } catch (e: any) {
        console.error('Donation Storage Folder Rename Error:', e);
        return { success: false, message: `Donation storage rename error: ${e.message}` };
    }
}

/**
 * Server Action to scan all campaigns, leads, and donations and migrate their Cloud Storage folders
 * to the standardized Case ID format (caseId_docId or multi-case concatenated caseId1_caseId2_docId).
 */
export async function migrateStorageFoldersAction(): Promise<{
    success: boolean;
    message: string;
    migratedCampaignFolders: number;
    migratedLeadFolders: number;
    migratedDonationFolders: number;
    totalFilesMoved: number;
}> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) return {
        success: false,
        message: ADMIN_SDK_ERROR_MESSAGE,
        migratedCampaignFolders: 0,
        migratedLeadFolders: 0,
        migratedDonationFolders: 0,
        totalFilesMoved: 0
    };

    try {
        const { generateNextUseCaseIdAdmin } = await import('@/lib/use-case-id');
        const { extractCaseIdsFromDonation } = await import('@/lib/storage-path');

        let migratedCampaignFolders = 0;
        let migratedLeadFolders = 0;
        let migratedDonationFolders = 0;
        let totalFilesMoved = 0;

        const processCollectionStorage = async (colName: 'campaigns' | 'leads') => {
            const snap = await adminDb.collection(colName).get();
            for (const doc of snap.docs) {
                const data = doc.data();
                let caseId = data.caseId as string | undefined;

                if (!caseId) {
                    caseId = await generateNextUseCaseIdAdmin(adminDb, data.startDate || new Date().toISOString(), colName);
                    await doc.ref.update({ caseId });
                }

                const res = await renameStorageFolderAction(colName, doc.id, undefined, caseId);
                if (res.success && (res.movedFilesCount || 0) > 0) {
                    totalFilesMoved += res.movedFilesCount || 0;
                    if (colName === 'campaigns') migratedCampaignFolders++;
                    else migratedLeadFolders++;
                }
            }
        };

        const processDonationStorage = async () => {
            const snap = await adminDb.collection('donations').get();
            for (const doc of snap.docs) {
                const data = doc.data();
                const caseIds = extractCaseIdsFromDonation(data);
                const res = await renameDonationStorageFolderAction(doc.id, undefined, caseIds);
                if (res.success && (res.movedFilesCount || 0) > 0) {
                    totalFilesMoved += res.movedFilesCount || 0;
                    migratedDonationFolders++;
                }
            }
        };

        await processCollectionStorage('campaigns');
        await processCollectionStorage('leads');
        await processDonationStorage();

        try {
            revalidatePath('/campaign-members');
            revalidatePath('/leads-members');
            revalidatePath('/donations');
            revalidatePath('/settings/data-health');
        } catch (e) {}

        return {
            success: true,
            message: `Storage migration complete! Renamed ${migratedCampaignFolders} campaign, ${migratedLeadFolders} lead, and ${migratedDonationFolders} donation folders. Moved ${totalFilesMoved} files total.`,
            migratedCampaignFolders,
            migratedLeadFolders,
            migratedDonationFolders,
            totalFilesMoved
        };
    } catch (e: any) {
        console.error('Migrate Storage Folders Error:', e);
        return {
            success: false,
            message: `Storage migration failed: ${e.message}`,
            migratedCampaignFolders: 0,
            migratedLeadFolders: 0,
            migratedDonationFolders: 0,
            totalFilesMoved: 0
        };
    }
}

