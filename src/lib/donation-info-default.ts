import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat – An Obligatory Pillar Of Islam",
        description: "What Is Zakat?\nZakat Is One Of The Five Pillars Of Islam. Every Qualifying Muslim Must Contribute 2.5% Of Their Accumulated Savings Annually Once It Exceeds The Minimum Threshold (Nisab).",
        quranVerse: "Establish Prayer And Give Zakat, And Whatever Good You Put Forward For Yourselves - You Will Find It With Allah.",
        quranSource: "Surah Al-Baqarah 2:110",
        purposePoints: [
            "What Is Nisab? The Minimum Threshold Required To Make Zakat Obligatory, Equivalent To 87.48 Grams Of Gold Or 612.36 Grams Of Silver Held For One Lunar Year.",
            "The 8 Eligible Recipient Categories (According To Quran 9:60):",
            "1. The Needy (Faqeer) - Those With No Independent Income.",
            "2. The Poor (Miskeen) - Those Whose Income Does Not Meet Basic Needs.",
            "3. Zakat Collectors (Aamil).",
            "4. To Reconcile Hearts (Muallafatul Quloob).",
            "5. To Free Captives (Fir-riqab).",
            "6. Those In Debt (Al-Gharimin).",
            "7. For The Cause Of Allah (Fi Sabilillah).",
            "8. The Wayfarer/Traveler (Ibn-us-Sabeel)."
        ],
        useCasesHeading: "Practical Scenarios & Methodology",
        useCases: [
            { id: 'u1', title: "Case 1: Ration Kits", description: "If A Family Falls Under The Needy Or Poor Category, Zakat Funds Can Provide Essential Food Supplies.", isAllowed: true, isHidden: false },
            { id: 'u2', title: "Case 2: Medical Emergency", description: "Direct Payment To Hospitals Or Pharmacies For Life-Saving Treatment Of Qualifying Patients.", isAllowed: true, isHidden: false },
            { id: 'u3', title: "Case 3: Debt Relief", description: "Assisting Individuals Overwhelmed By Debt To Regain Financial Stability.", isAllowed: true, isHidden: false },
            { id: 'u4', title: "Case 4: Infrastructure", description: "Zakat Funds Cannot Be Used For Building Maintenance, School Structures, Or Public Roads. Use Lillah For These.", isAllowed: false, isHidden: false },
            { id: 'u5', title: "Case 5: Academic Fees", description: "Educational Costs For Deserving Students From Qualifying Backgrounds.", isAllowed: true, isHidden: false }
        ],
        qaItems: [
            { 
                id: 'q1', 
                question: "What Is The Correct Way To Give Zakat?", 
                answer: "1. Intention: Formulate The Sincere Intention For Zakat. 2. Full Ownership: Ensure The Recipient Gains Full Control Over The Aid. 3. Confidentiality: Maintain The Dignity Of The Recipient By Avoiding Public Display.", 
                isHidden: false 
            }
        ],
        usage: "Zakat is a mandatory charitable contribution considered a religious duty in Islam. It is only given to specific categories defined by Shariah.",
        restrictions: "Cannot be used for non-living objects like buildings or the administrative overhead of the organization itself.",
    },
    {
        id: 'sadaqah',
        title: "Sadaqah (Voluntary Charity)",
        description: "Sadaqah Is Voluntary Charity Given Purely To Seek The Pleasure Of Allah, Provide Relief, And Remove Hardships.",
        useCases: [],
        qaItems: [],
        usage: "Can be given to anyone in need, regardless of faith, and used for any beneficial community project.",
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "A Compensation Paid When An Individual Is Unable To Fast During Ramadan Due To Valid Health Reasons Or Advanced Age.",
        useCases: [],
        qaItems: [],
        usage: "Exclusively used to provide meals for the needy for every day of fasting missed.",
    },
    {
        id: 'lillah',
        title: "Lillah (For The Sake Of Allah)",
        description: "Voluntary Contributions Intended Specifically For Public Welfare, Institutions, And Religious Infrastructure.",
        useCases: [],
        qaItems: [],
        usage: "Used for running costs, salaries, and maintenance of community institutions like schools and mosques.",
    },
    {
        id: 'interest',
        title: "Interest Disposal (Riba)",
        description: "Interest Earned On Bank Accounts Is Prohibited In Islam. If Received, It Must Be Disposed Of To The Poor Without Any Intention Of Spiritual Reward.",
        useCases: [],
        qaItems: [],
        usage: "Must be given entirely to those in need, typically for non-food support or general welfare utilities.",
    }
];