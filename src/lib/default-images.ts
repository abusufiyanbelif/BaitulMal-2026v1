/**
 * Default Institutional Asset Mapping
 * Maps purposes, categories, and subcategories to premium high-fidelity background images.
 */

export interface DefaultAsset {
    id: string;
    url: string;
    label: string;
    purpose: string;
    subcategory?: string;
}

export const defaultInstitutionalAssets: DefaultAsset[] = [
    {
        id: 'medical_surgery',
        url: '/defaults/images/medical_surgery.png',
        label: 'Surgical & Hospital Care',
        purpose: 'Medical',
        subcategory: 'Surgery'
    },
    {
        id: 'medical_general',
        url: '/defaults/images/medical_surgery.png',
        label: 'General Healthcare',
        purpose: 'Medical'
    },
    {
        id: 'education_higher',
        url: '/defaults/images/education_higher.png',
        label: 'Higher Education & Libraries',
        purpose: 'Education',
        subcategory: 'University'
    },
    {
        id: 'education_general',
        url: '/defaults/images/education_higher.png',
        label: 'Academic Support',
        purpose: 'Education'
    },
    {
        id: 'relief_ration',
        url: '/defaults/images/relief_ration.png',
        label: 'Food Kits & Ration',
        purpose: 'Relief',
        subcategory: 'Ration'
    },
    {
        id: 'relief_general',
        url: '/defaults/images/relief_ration.png',
        label: 'Humanitarian Relief',
        purpose: 'Relief'
    },
    {
        id: 'zakat_general',
        url: '/defaults/images/zakat_charity.png',
        label: 'Zakat & Spiritual Charity',
        purpose: 'Zakat'
    },
    {
        id: 'sadaqah_general',
        url: '/defaults/images/zakat_charity.png',
        label: 'Sadaqah & General Aid',
        purpose: 'General'
    },
    {
        id: 'other_general',
        url: '/defaults/images/zakat_charity.png',
        label: 'Institutional Support',
        purpose: 'Other'
    }
];

/**
 * Returns the most relevant default image based on purpose and subcategory.
 */
export function getDefaultImage(purpose: string, subcategory?: string): string {
    // 1. Try to match purpose AND subcategory
    if (subcategory) {
        const exactMatch = defaultInstitutionalAssets.find(
            a => a.purpose.toLowerCase() === purpose.toLowerCase() && 
                 a.subcategory?.toLowerCase() === subcategory.toLowerCase()
        );
        if (exactMatch) return exactMatch.url;
    }

    // 2. Try to match purpose
    const purposeMatch = defaultInstitutionalAssets.find(
        a => a.purpose.toLowerCase() === purpose.toLowerCase()
    );
    if (purposeMatch) return purposeMatch.url;

    // 3. Final fallback
    return '/defaults/images/zakat_charity.png';
}
