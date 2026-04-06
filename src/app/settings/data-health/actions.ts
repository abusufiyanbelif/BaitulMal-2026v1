'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

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

        donationsSnap.docs.forEach(doc => {
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

        campaignsSnap.docs.forEach(doc => {
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

        leadsSnap.docs.forEach(doc => {
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

        beneficiariesSnap.docs.forEach(doc => {
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

        donorsSnap.docs.forEach(doc => {
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
 */
export async function recalculateAllCollectedAmountsAction(): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const [campaignsSnap, leadsSnap, donationsSnap] = await Promise.all([
            adminDb.collection('campaigns').get(),
            adminDb.collection('leads').get(),
            adminDb.collection('donations').get(),
        ]);

        const campaignMap: Record<string, number> = {};
        const leadMap: Record<string, number> = {};

        donationsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.status !== 'Verified') return;
            (data.linkSplit || []).forEach((link: any) => {
                if (link.linkType === 'campaign') campaignMap[link.linkId] = (campaignMap[link.linkId] || 0) + link.amount;
                else if (link.linkType === 'lead') leadMap[link.linkId] = (leadMap[link.linkId] || 0) + link.amount;
            });
        });

        const CHUNK = 450;
        const allEntries: { ref: FirebaseFirestore.DocumentReference; val: number }[] = [
            ...campaignsSnap.docs.map(d => ({ ref: d.ref, val: campaignMap[d.id] || 0 })),
            ...leadsSnap.docs.map(d => ({ ref: d.ref, val: leadMap[d.id] || 0 })),
        ];

        for (let i = 0; i < allEntries.length; i += CHUNK) {
            const batch = adminDb.batch();
            allEntries.slice(i, i + CHUNK).forEach(e => batch.update(e.ref, { collectedAmount: e.val }));
            await batch.commit();
        }

        revalidatePath('/campaigns');
        revalidatePath('/leads-members');
        revalidatePath('/dashboard');

        return { success: true, message: `Recalculated collectedAmount for ${campaignsSnap.size} campaigns and ${leadsSnap.size} leads.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
