import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat – Islam ka Farz Rukun",
        description: "🔹 Zakat Kya Hai?\nZakat Islam ke 5 Arkaan (Five Pillars) mein se ek hai. Har sahib-e-Nisab Muslim par saal mein ek martaba 2.5% apni jama poonji par farz hai.\n\nQur’an: “Namaz qayam karo aur Zakat ada karo.” — (Surah Al-Baqarah 2:43)",
        quranVerse: "Innamas-sadaqātu lil-fuqarā'i wal-masākīni wal-'āmilīna 'alayhā wal-mu'allafati qulūbuhum wa fir-riqābi wal-ghārimīna wa fī sabīlillāhi wabnis-sabīli farīḍatam minallāhi wallāhu 'alīmun ḥakīm.",
        quranSource: "Surah At-Tawbah 9:60",
        purposePoints: [
            "🔹 Nisab Kya Hai? Agar kisi ke paas: 87.48 gram sona (approx 7.5 Tola) ya 612.36 gram chandi (approx 52.5 Tola) ya unki barabar cash/savings ho Aur yeh maal 1 saal tak us ke paas rahe, toh Zakat farz hoti hai.",
            "🔹 Zakat Kin 8 Categories Ko Di Ja Sakti Hai? (Qur’an 9:60 ke mutabiq):",
            "1. Faqeer (Jiske paas guzare laayak maal na ho)",
            "2. Miskeen (Jo nihayat mohtaj ho)",
            "3. Zakat collectors (Aamil)",
            "4. Dil jorne ke liye (Muallafatul Quloob)",
            "5. Ghulamon ko azaad karana (Fir-riqab)",
            "6. Qarzdar (Jo qarz mein dooba ho - Al-Gharimin)",
            "7. Fi Sabilillah (Allah ke raaste mein)",
            "8. Musafir (Ibn-us-Sabeel)"
        ],
        useCasesHeading: "🔹 Practical Scenarios & Tareeqa (Methodology)",
        useCases: [
            { id: 'u1', title: "✅ Case 1: Ration Kit", description: "Agar mustahiq family faqeer/miskeen category mein hai → Zakat ke paison se ration kit di ja sakti hai.", isAllowed: true, isHidden: false },
            { id: 'u2', title: "✅ Case 2: Medical Emergency", description: "Patient jo mustahiq hai, uske ilaaj ke liye direct hospital ya chemist ko payment Zakat se ki ja sakti hai.", isAllowed: true, isHidden: false },
            { id: 'u3', title: "✅ Case 3: Debt Relief", description: "Jo log qarz ke bojh tale dabe hain, unka qarz utaarne ke liye Zakat di ja sakti hai.", isAllowed: true, isHidden: false },
            { id: 'u4', title: "❌ Case 4: Infrastructure", description: "Zakat ka paisa Masjid ki tameer, School building ya Sadak banane mein nahi lagaya ja sakta. Iske liye Lillah/Sadaqah use karein.", isAllowed: false, isHidden: false },
            { id: 'u5', title: "✅ Case 5: Student Fees", description: "Mustahiq aur ghareeb students ki school/college fees Zakat se bhari ja sakti hai.", isAllowed: true, isHidden: false }
        ],
        qaItems: [
            { 
                id: 'q1', 
                question: "Zakat Dene Ka Sahi Tareeqa Kya Hai?", 
                answer: "1. Niyyat: Zakat dete waqt dil mein niyyat hona zaroori hai.\n2. Milkiyat (Ownership): Paisa ya samaan mustahiq ki malkiyat mein dena zaroori hai (Tamleek).\n3. Confidentiality: Koshish karein ke lene wale ki izzat-e-nafs majrooh na ho.", 
                isHidden: false 
            }
        ],
        usage: "Zakat is a mandatory charitable contribution considered a tax and a religious duty in Islam. It is only given to specific categories of people defined by Shariah.",
        restrictions: "Cannot be used for non-living objects like buildings or administrative salaries of the organization itself.",
    },
    {
        id: 'sadaqah',
        title: "Sadaqah (Voluntary Charity)",
        description: "Sadaqah is voluntary charity given purely for the sake of Allah to remove hardships and seek blessings.",
        useCases: [],
        qaItems: [],
        usage: "Can be given to anyone in need, regardless of faith, and used for any beneficial project.",
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "Donation made when someone is unable to fast during Ramadan due to valid health reasons or old age.",
        useCases: [],
        qaItems: [],
        usage: "Primarily used to provide two meals a day to a poor person for every missed fast.",
    },
    {
        id: 'lillah',
        title: "Lillah (For the Sake of Allah)",
        description: "Voluntary Sadaqah intended specifically for institutions, mosques, schools, and general public welfare.",
        useCases: [],
        qaItems: [],
        usage: "Used for infrastructure, salaries, and running costs of community institutions.",
    },
    {
        id: 'interest',
        title: "Interest (Riba Disposal)",
        description: "Bank interest is prohibited in Islam. If earned, it must be disposed of to the poor without intention of spiritual reward.",
        useCases: [],
        qaItems: [],
        usage: "Must be given away entirely to those in need, typically for non-food items or general welfare if needed.",
    }
];
