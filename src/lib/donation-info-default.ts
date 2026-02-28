import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat – Islam ka Farz Rukun",
        description: "🔹 Zakat Kya Hai?\nZakat Islam ke 5 Arkaan (Five Pillars) mein se ek hai. Har sahib-e-Nisab Muslim par saal mein ek martaba 2.5% apni jama poonji par farz hai.",
        quranVerse: "Namaz qayam karo aur Zakat ada karo.",
        quranSource: "Surah Al-Baqarah 2:43",
        purposePoints: [
            "🔹 Nisab Kya Hai? Agar kisi ke paas: 87.48 gram sona ya 612.36 gram chandi ya unki barabar cash/savings ho Aur yeh maal 1 saal tak us ke paas rahe, toh Zakat farz hoti hai.",
            "🔹 Zakat Kin 8 Categories Ko Di Ja Sakti Hai? (Qur’an 9:60 ke mutabiq) Faqeer, Miskeen, Zakat collectors (Aamil), Dil jorne ke liye (Muallafatul Quloob), Ghulamon ko azaad karana, Qarzdar (debt mein dooba hua), Fi Sabilillah (Allah ke raaste mein), Musafir (Ibn-us-Sabeel)",
            "🔹 Zakat Kahan Use Nahi Ho Sakti?\n❌ Masjid construction\n❌ Madrasa building\n❌ Hospital building\n❌ Apne walidain, bachon ko\n❌ Infrastructure projects"
        ],
        useCasesHeading: "🔹 Detailed Zakat Scenarios (Important)",
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
        usage: "🔹 Zakat Dene Ka Tareeqa (How)\n- Niyyat zaroori hai\n- Mustahiq ko milkiyat transfer honi chahiye\n- Direct cash ya goods dono jaiz\n- Organization ke through dene par ensure karein ke Shariah compliance ho",
        restrictions: "❌ It cannot be used for infrastructure (like building mosques or schools) or given to immediate family members (parents, children).",
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
        useCases: [],
        qaItems: [],
        usage: "Can be given to anyone in need, regardless of faith.",
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "Donation made when someone is unable to fast during Ramadan due to valid health reasons.",
        useCases: [],
        qaItems: [],
        usage: "Primarily used to provide meals to the poor and needy.",
    },
    {
        id: 'lillah',
        title: "Lillah (For the Sake of Allah)",
        description: "Voluntary Sadaqah intended for institutions and public welfare.",
        useCases: [],
        qaItems: [],
        usage: "Used for infrastructure, salaries, and running costs of community institutions.",
    },
    {
        id: 'interest',
        title: "Interest (Riba Disposal)",
        description: "Accumulated bank interest must be disposed of without intention of reward.",
        useCases: [],
        qaItems: [],
        usage: "Must be given away without spiritual reward expectation.",
    }
];
