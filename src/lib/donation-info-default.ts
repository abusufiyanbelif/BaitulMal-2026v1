
import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat – Maal Ki Paaki aur Samaji Insaf",
        description: "Zakat Islam ka farz rukun hai. Ramzan mein zyada log apni Zakat ada karte hain kyun ke ajr zyada aur narm hota hai.",
        quranVerse: "Apne maal mein se Zakat ada karo taake tum paak ho jao.",
        quranSource: "Surah At-Tawbah 9:103",
        purposePoints: [
            "Maal ko paak karna",
            "Ghurbat kam karna",
            "Samaj mein barabari paida karna",
            "Haqdaar tak haq pohanchana"
        ],
        useCases: [
            "Direct financial aid to widowed or orphan-headed families",
            "Paying for life-saving surgeries for verified Zakat-eligible patients",
            "Providing basic ration supplies to daily wage workers who cannot earn"
        ],
        usage: "Its use is strictly restricted to eight categories of people defined in the Quran (9:60), including the poor, the needy, those in debt, and stranded travellers.",
        restrictions: "It cannot be used for infrastructure (like building mosques or schools) or given to immediate family members (parents, children).",
        imageHint: "charity helping"
    },
    {
        id: 'sadaqah',
        title: "Sadaqah (Voluntary Charity)",
        description: "Sadaqah is a broad term for voluntary charity given purely for the sake of Allah. Unlike Zakat, it has no fixed amount or required timing.",
        quranVerse: "Who is it that would loan Allah a goodly loan so He may multiply it for him many times over?",
        quranSource: "Surah Al-Baqarah 2:245",
        purposePoints: [
            "Seeking pleasure of Allah",
            "Removing hardship from others",
            "Purifying the character",
            "Continuous reward (Sadaqah Jariyah)"
        ],
        useCases: [
            "Emergency relief funds for disaster-hit areas",
            "Installing water pumps in drought-prone regions (Sadaqah Jariyah)",
            "Supporting small educational initiatives for the community"
        ],
        usage: "It has no restrictions on recipients and can be given to anyone in need, regardless of faith.",
        impact: "It is often used for immediate relief like food, clothing, and medical care.",
        imageHint: "giving food"
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "Fidiya is a religious donation made in Islam when someone is unable to fast during Ramadan due to valid reasons.",
        quranVerse: "And upon those who are able [to fast, but with hardship] - a ransom [as substitute] of feeding a poor person [each day].",
        quranSource: "Surah Al-Baqarah 2:184",
        purposePoints: [
            "Compensating for missed fasts",
            "Providing essential meals",
            "Fulfilling religious duty",
            "Supporting the elderly and sick"
        ],
        useCases: [
            "Providing Suhoor and Iftar meals for the poor during Ramadan",
            "Bulk purchase of basic food grains for distribution",
            "Feeding needy travelers who are stranded"
        ],
        usage: "The money is used to provide meals to the poor and needy. Typically, it covers two meals for one person for each missed fast.",
        keyUse: "It serves as a compensation for missed fasts and is a separate obligation from Zakat.",
        imageHint: "meal feeding"
    },
    {
        id: 'lillah',
        title: "Lillah (For the Sake of Allah)",
        description: "Lillah is a type of voluntary Sadaqah typically used to denote donations intended for institutions.",
        purposePoints: [
            "Building community infrastructure",
            "Supporting Islamic education",
            "Maintaining places of worship",
            "General public benefit"
        ],
        useCases: [
            "Construction and maintenance of mosques",
            "Salaries for teachers in community Madrasas",
            "Payment of electricity and water bills for charitable institutions"
        ],
        usage: "It is primarily used for the construction and maintenance of mosques, schools (Madrasas), hospitals, and other community infrastructure.",
        keyUse: "Unlike Zakat, Lillah can be used to cover the running costs (utilities, staff salaries) of Islamic institutions.",
        imageHint: "mosque construction"
    },
    {
        id: 'interest',
        title: "Interest (Riba/Bank Interest Disposal)",
        description: "In Islam, taking or giving interest is forbidden. Accumulated bank interest must be disposed of without intention of reward.",
        purposePoints: [
            "Purifying one's wealth",
            "Removing prohibited gains",
            "Supporting public utility projects",
            "Assisting the extremely poor"
        ],
        useCases: [
            "Building or repairing public toilets and sanitation facilities",
            "Repairing village roads or drainage systems",
            "Providing simple relief items to the poor where no spiritual reward is expected"
        ],
        usage: "It must be given away to charity without the intention of reward.",
        application: "It is commonly used for public utility projects such as building public toilets, repairing roads, or providing generic relief to the poor.",
        imageHint: "public welfare"
    }
];
