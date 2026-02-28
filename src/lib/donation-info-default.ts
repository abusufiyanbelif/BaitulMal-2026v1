
import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat – Maal Ki Paaki aur Samaji Insaf",
        description: "Zakat Islam ka farz rukun hai. Yeh har sahib-e-nisab musalman par saal mein ek baar farz hai.",
        quranVerse: "Apne maal mein se Zakat ada karo taake tum paak ho jao.",
        quranSource: "Surah At-Tawbah 9:103",
        purposePoints: [
            "Maal ko paak karna",
            "Ghurbat kam karna",
            "Samaj mein barabari paida karna",
            "Haqdaar tak haq pohanchana"
        ],
        useCasesHeading: "Detailed Zakat Scenarios (Important)",
        useCases: [
            { id: 'u1', title: "Case 1: Ration Kit", description: "Agar mustahiq family faqeer/miskeen category mein hai → Zakat se ration diya ja sakta hai.", isAllowed: true, isHidden: false },
            { id: 'u2', title: "Case 2: Medical Emergency", description: "Agar patient ke paas ilaaj ke paise nahi → Zakat allowed.", isAllowed: true, isHidden: false },
            { id: 'u3', title: "Case 3: Debt Relief", description: "Agar koi qarz mein dooba hai aur repay nahi kar sakta → Zakat allowed.", isAllowed: true, isHidden: false },
            { id: 'u4', title: "Case 4: School Building Banana", description: "Allowed nahi (yeh Lillah se hoga).", isAllowed: false, isHidden: false },
            { id: 'u5', title: "Case 5: Student Fees", description: "Agar student ghareeb hai aur fees nahi de sakta → Zakat allowed.", isAllowed: true, isHidden: false }
        ],
        qaItems: [
            { id: 'q1', question: "Zakat kis par farz hai?", answer: "Har us musalman par jo sahib-e-nisab ho (jis ke paas ek saal tak nisab ke barabar maal rahe).", reference: "Fiqh Ruling", isHidden: false }
        ],
        usage: "Its use is strictly restricted to eight categories defined in the Quran.",
        restrictions: "Cannot be used for infrastructure or given to parents/children.",
    },
    {
        id: 'sadaqah',
        title: "Sadaqah (Voluntary Charity)",
        description: "Sadaqah is voluntary charity given purely for the sake of Allah to remove hardships.",
        purposePoints: [
            "Seeking pleasure of Allah",
            "Removing hardship",
            "Continuous reward (Jariyah)"
        ],
        useCasesHeading: "Practical Use Cases",
        useCases: [
            { id: 's1', title: "Emergency Aid", description: "Food, clothes or medicine for anyone in need.", isAllowed: true, isHidden: false },
            { id: 's2', title: "Water Projects", description: "Installing pumps or wells.", isAllowed: true, isHidden: false }
        ],
        qaItems: [],
        usage: "Can be given to anyone in need, regardless of faith.",
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "Donation made when someone is unable to fast during Ramadan due to valid health reasons.",
        useCasesHeading: "Usage Examples",
        useCases: [
            { id: 'f1', title: "Feeding Needy", description: "Providing Suhoor/Iftar for those who cannot fast.", isAllowed: true, isHidden: false }
        ],
        qaItems: [],
        usage: "Primarily used to provide meals to the poor and needy.",
    },
    {
        id: 'lillah',
        title: "Lillah (For the Sake of Allah)",
        description: "Voluntary Sadaqah intended for institutions and public welfare.",
        useCasesHeading: "Institutional Support",
        useCases: [
            { id: 'l1', title: "Mosque Construction", description: "Building or repairing Masjids.", isAllowed: true, isHidden: false },
            { id: 'l2', title: "Madrasa Staff", description: "Salaries for teachers and utilities.", isAllowed: true, isHidden: false }
        ],
        qaItems: [],
        usage: "Used for infrastructure, salaries, and running costs of community institutions.",
    },
    {
        id: 'interest',
        title: "Interest (Riba Disposal)",
        description: "Accumulated bank interest must be disposed of without intention of reward.",
        useCasesHeading: "Disposal Methods",
        useCases: [
            { id: 'i1', title: "Public Toilets", description: "Building sanitation facilities.", isAllowed: true, isHidden: false },
            { id: 'i2', title: "Road Repairs", description: "Generic public utility works.", isAllowed: true, isHidden: false }
        ],
        qaItems: [],
        usage: "Must be given away without spiritual reward expectation.",
    }
];
