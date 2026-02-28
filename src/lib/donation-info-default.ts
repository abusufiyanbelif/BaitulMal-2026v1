import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat – Islam ka Farz Rukun",
        description: "Zakat Islam ke 5 Arkaan (Five Pillars) mein se ek hai. Har sahib-e-Nisab Muslim par saal mein ek martaba 2.5% apni jama poonji par farz hai.",
        quranVerse: "Namaz qayam karo aur Zakat ada karo.",
        quranSource: "Surah Al-Baqarah 2:43",
        purposePoints: [
            "🔹 Nisab: 87.48 gram sona / 612.36 gram chandi ya unki barabar cash/savings (1 saal tak).",
            "🔹 Kin 8 Categories Ko Di Ja Sakti Hai? (Quran 9:60):",
            "1. Faqeer (Nidhaar), 2. Miskeen (Mohtaj), 3. Aamil (Zakat collect karne wale), 4. Muallafatul Quloob (Dil jorne ke liye), 5. Ghulamon ko azaad karana, 6. Qarzdar (Debt relief), 7. Fi Sabilillah (Allah ke raaste mein), 8. Musafir (Ibn-us-Sabeel)."
        ],
        useCasesHeading: "Detailed Zakat Scenarios (Important)",
        useCases: [
            { id: 'u1', title: "✅ Case 1: Ration Kit", description: "Agar mustahiq family faqeer/miskeen category mein hai → Zakat se ration diya ja sakta hai.", isAllowed: true, isHidden: false },
            { id: 'u2', title: "✅ Case 2: Medical Emergency", description: "Agar patient ke paas ilaaj ke paise nahi → Zakat allowed.", isAllowed: true, isHidden: false },
            { id: 'u3', title: "✅ Case 3: Debt Relief", description: "Agar koi qarz mein dooba hai aur repay nahi kar sakta → Zakat allowed.", isAllowed: true, isHidden: false },
            { id: 'u4', title: "❌ Case 4: School Building Banana", description: "Allowed nahi (yeh Lillah se hoga).", isAllowed: false, isHidden: false },
            { id: 'u5', title: "✅ Case 5: Student Fees", description: "Agar student ghareeb hai aur fees nahi de sakta → Zakat allowed.", isAllowed: true, isHidden: false }
        ],
        qaItems: [
            { id: 'q1', question: "Zakat kis par farz hai?", answer: "Har us musalman par jo sahib-e-nisab ho (jis ke paas ek saal tak nisab ke barabar maal rahe).", reference: "Fiqh Ruling", isHidden: false }
        ],
        usage: "Tareeqa (How): Niyyat zaroori hai. Mustahiq ko milkiyat transfer honi chahiye. Direct cash ya goods dono jaiz. Organization ke through dene par ensure karein ke Shariah compliance ho.",
        restrictions: "Kahan Use Nahi Ho Sakti: Masjid construction, Madrasa building, Hospital building, Infrastructure projects, ya apne walidain/bachon ko dena sakht mana hai.",
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
        useCases: [],
        qaItems: [],
        usage: "Can be given to anyone in need, regardless of faith.",
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "Donation made when someone is unable to fast during Ramadan due to valid health reasons.",
        useCasesHeading: "Usage Examples",
        useCases: [],
        qaItems: [],
        usage: "Primarily used to provide meals to the poor and needy.",
    },
    {
        id: 'lillah',
        title: "Lillah (For the Sake of Allah)",
        description: "Voluntary Sadaqah intended for institutions and public welfare.",
        useCasesHeading: "Institutional Support",
        useCases: [],
        qaItems: [],
        usage: "Used for infrastructure, salaries, and running costs of community institutions.",
    },
    {
        id: 'interest',
        title: "Interest (Riba Disposal)",
        description: "Accumulated bank interest must be disposed of without intention of reward.",
        useCasesHeading: "Disposal Methods",
        useCases: [],
        qaItems: [],
        usage: "Must be given away without spiritual reward expectation.",
    }
];
