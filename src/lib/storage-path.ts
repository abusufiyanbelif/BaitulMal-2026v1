/**
 * Utility functions for resolving Cloud Storage folder paths using Case ID format (caseId_docId).
 * Supports single-initiative paths as well as multi-cause concatenated donation storage folders.
 */

export function getStorageFolderName(caseId?: string, docId?: string): string {
  const cleanCaseId = (caseId || '').trim();
  const cleanDocId = (docId || '').trim();

  if (cleanCaseId && cleanDocId) {
    return `${cleanCaseId}_${cleanDocId}`;
  }
  if (cleanCaseId) {
    return cleanCaseId;
  }
  return cleanDocId || 'unassigned';
}

export function getStorageFolderPath(
  module: 'campaigns' | 'leads' | 'donations' | 'beneficiaries',
  caseId?: string,
  docId?: string
): string {
  const folderName = getStorageFolderName(caseId, docId);
  return `${module}/${folderName}`;
}

/**
 * Resolves a donation storage folder name given single or multiple Case IDs.
 * If multiple Case IDs exist (e.g. donation split across 2 causes), they are sorted alphabetically
 * and joined with an underscore (`caseId1_caseId2_docId`).
 */
export function getDonationStorageFolderName(caseIds?: (string | undefined)[], docId?: string): string {
  const validCaseIds = Array.from(
    new Set(
      (caseIds || [])
        .map(id => (id || '').trim())
        .filter(id => id.length > 0)
    )
  ).sort();

  const cleanDocId = (docId || '').trim();

  if (validCaseIds.length > 0) {
    const joinedCaseIds = validCaseIds.join('_');
    return cleanDocId ? `${joinedCaseIds}_${cleanDocId}` : joinedCaseIds;
  }

  return cleanDocId || 'unassigned';
}

/**
 * Returns the full Cloud Storage folder path for a donation with single or multiple Case IDs.
 * Example: `donations/0109202601_0509202602_don123`
 */
export function getDonationStorageFolderPath(caseIds?: (string | undefined)[], docId?: string): string {
  const folderName = getDonationStorageFolderName(caseIds, docId);
  return `donations/${folderName}`;
}

/**
 * Extracts all unique Case IDs linked to a donation record (from caseId field, linkSplit array, or campaignId/leadId fields).
 */
export function extractCaseIdsFromDonation(donationData: any): string[] {
  const set = new Set<string>();

  if (donationData?.caseId && typeof donationData.caseId === 'string' && donationData.caseId.trim()) {
    set.add(donationData.caseId.trim());
  }

  if (Array.isArray(donationData?.linkSplit)) {
    donationData.linkSplit.forEach((link: any) => {
      if (link?.caseId && typeof link.caseId === 'string' && link.caseId.trim()) {
        set.add(link.caseId.trim());
      }
    });
  }

  return Array.from(set).sort();
}
