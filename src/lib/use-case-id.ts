import { getDocs, collection, query, where } from 'firebase/firestore';

/**
 * Converts a Date object or date string (YYYY-MM-DD or ISO) into DDMMYYYY string format.
 */
export function formatDateToDDMMYYYY(dateInput?: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}${month}${year}`;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Validates whether a given ID string matches the DDMMYYYYXX standard format (10 or more digits).
 */
export function isValidUseCaseId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^\d{10,}$/.test(id.trim());
}

/**
 * Generates the next sequential Case / Use Case ID for a given date (DDMMYYYYXX format).
 * Client-side Firestore implementation.
 */
export async function generateNextUseCaseIdClient(
  db: any,
  dateInput?: Date | string | null,
  collectionName: 'campaigns' | 'leads' = 'campaigns'
): Promise<string> {
  const dateStr = formatDateToDDMMYYYY(dateInput);

  if (!db) return `${dateStr}01`;

  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    
    let maxSeq = 0;
    snap.forEach((doc) => {
      const data = doc.data();
      const caseId = data.caseId as string | undefined;
      if (caseId && caseId.startsWith(dateStr)) {
        const seqStr = caseId.slice(dateStr.length);
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const seqFormatted = String(nextSeq).padStart(2, '0');
    return `${dateStr}${seqFormatted}`;
  } catch (error) {
    console.error('Error generating next Use Case ID:', error);
    return `${dateStr}01`;
  }
}

/**
 * Generates the next sequential Case / Use Case ID using Admin SDK (server-side).
 */
export async function generateNextUseCaseIdAdmin(
  adminDb: any,
  dateInput?: Date | string | null,
  collectionName: 'campaigns' | 'leads' = 'campaigns'
): Promise<string> {
  const dateStr = formatDateToDDMMYYYY(dateInput);

  if (!adminDb) return `${dateStr}01`;

  try {
    const snap = await adminDb.collection(collectionName).get();
    let maxSeq = 0;

    snap.forEach((doc: any) => {
      const data = doc.data();
      const caseId = data.caseId as string | undefined;
      if (caseId && caseId.startsWith(dateStr)) {
        const seqStr = caseId.slice(dateStr.length);
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const seqFormatted = String(nextSeq).padStart(2, '0');
    return `${dateStr}${seqFormatted}`;
  } catch (error) {
    console.error('Error generating next Use Case ID (Admin):', error);
    return `${dateStr}01`;
  }
}

/**
 * Cascades Case ID updates across all related records in Firestore (Donations, Beneficiaries, Verifications, Audit Logs).
 */
export async function cascadeUpdateUseCaseIdAdmin(
  adminDb: any,
  collectionName: 'campaigns' | 'leads',
  docId: string,
  oldCaseId: string | undefined,
  newCaseId: string,
  updatedBy: { id: string; name: string }
): Promise<{ success: boolean; message: string; updatedCounts: Record<string, number> }> {
  if (!adminDb) {
    return { success: false, message: 'Admin Database not initialized.', updatedCounts: {} };
  }

  const cleanNewId = newCaseId.trim();
  if (!isValidUseCaseId(cleanNewId)) {
    return { success: false, message: 'Invalid Case ID format. Must be at least 10 digits (DDMMYYYYXX).', updatedCounts: {} };
  }

  try {
    const counts = {
      initiative: 0,
      donations: 0,
      verifications: 0,
      auditLogs: 0,
    };

    const batch = adminDb.batch();

    // 1. Update primary initiative document
    const initiativeRef = adminDb.collection(collectionName).doc(docId);
    batch.update(initiativeRef, {
      caseId: cleanNewId,
      updatedAt: new Date(),
      updatedById: updatedBy.id,
      updatedByName: updatedBy.name,
    });
    counts.initiative += 1;

    // 2. Cascade to Donations
    const donationsSnap = await adminDb.collection('donations').get();
    donationsSnap.forEach((dDoc: any) => {
      const dData = dDoc.data();
      let isUpdated = false;

      // Direct campaignId check
      let newCampaignId = dData.campaignId;
      if (dData.campaignId === docId || (oldCaseId && dData.campaignId === oldCaseId)) {
        newCampaignId = docId; // or cleanNewId if using caseId directly
        isUpdated = true;
      }

      // LinkSplit updates
      let updatedLinkSplit = dData.linkSplit;
      if (Array.isArray(dData.linkSplit)) {
        updatedLinkSplit = dData.linkSplit.map((link: any) => {
          const rawId = String(link.linkId || '');
          if (
            rawId === docId ||
            rawId === oldCaseId ||
            rawId === `campaign_${docId}` ||
            rawId === `lead_${docId}` ||
            (oldCaseId && (rawId === `campaign_${oldCaseId}` || rawId === `lead_${oldCaseId}`))
          ) {
            isUpdated = true;
            return {
              ...link,
              linkId: docId,
              caseId: cleanNewId,
            };
          }
          return link;
        });
      }

      if (isUpdated) {
        batch.update(dDoc.ref, {
          linkSplit: updatedLinkSplit,
          updatedAt: new Date(),
        });
        counts.donations += 1;
      }
    });

    // 3. Cascade to Pending Verifications
    const verificationsSnap = await adminDb.collection('pending_verifications').get();
    verificationsSnap.forEach((vDoc: any) => {
      const vData = vDoc.data();
      if (vData.targetId === docId || (oldCaseId && vData.targetId === oldCaseId)) {
        const newValue = vData.newValue ? { ...vData.newValue, caseId: cleanNewId } : undefined;
        batch.update(vDoc.ref, {
          ...(newValue ? { newValue } : {}),
          updatedAt: new Date(),
        });
        counts.verifications += 1;
      }
    });

    // 4. Record Audit Log for this ID modification
    const auditRef = adminDb.collection('audit_logs').doc();
    batch.set(auditRef, {
      id: auditRef.id,
      targetId: docId,
      targetCollection: collectionName,
      module: collectionName,
      action: 'UPDATE',
      description: `Updated Case ID from '${oldCaseId || 'N/A'}' to '${cleanNewId}'`,
      performedBy: updatedBy,
      changes: [{ field: 'caseId', old: oldCaseId || null, new: cleanNewId }],
      timestamp: new Date(),
    });
    counts.auditLogs += 1;

    await batch.commit();

    return {
      success: true,
      message: `Case ID successfully updated to ${cleanNewId}. Cascaded updates to ${counts.donations} donations and related records.`,
      updatedCounts: counts,
    };
  } catch (error: any) {
    console.error('Error executing cascading Case ID update:', error);
    return { success: false, message: `Failed to update Case ID: ${error.message}`, updatedCounts: {} };
  }
}
