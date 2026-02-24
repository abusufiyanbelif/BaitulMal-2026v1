
import type { DonationTypeInfo } from './types';

export const defaultDonationInfo: DonationTypeInfo[] = [
    {
        id: 'zakat',
        title: "Zakat (Obligatory Charity)",
        description: "Zakat is one of the Five Pillars of Islam. It is a mandatory annual payment of 2.5% of a Muslim's qualifying wealth (savings, gold, silver, business assets) if it exceeds a certain threshold called Nisab.",
        usage: "Its use is strictly restricted to eight categories of people defined in the Quran (9:60), including the poor, the needy, those in debt, and stranded travellers.",
        restrictions: "It cannot be used for infrastructure (like building mosques or schools) or given to immediate family members (parents, children).",
    },
    {
        id: 'sadaqah',
        title: "Sadaqah (Voluntary Charity)",
        description: "Sadaqah is a broad term for voluntary charity given purely for the sake of Allah. Unlike Zakat, it has no fixed amount or required timing. It can even include non-monetary acts like smiling or removing a harmful object from a path.",
        usage: "It has no restrictions on recipients and can be given to anyone in need, regardless of faith.",
        impact: "It is often used for immediate relief like food, clothing, and medical care.",
    },
    {
        id: 'fidiya',
        title: "Fidiya (Compensation)",
        description: "Fidiya is a religious donation made in Islam when someone is unable to fast during Ramadan due to illness, old age, or other valid reasons. It is intended to feed a needy person for each day of fasting that is missed.",
        usage: "The money is used to provide meals to the poor and needy. Typically, it covers two meals for one person for each missed fast.",
        keyUse: "It serves as a compensation for missed fasts and is a separate obligation from Zakat.",
    },
    {
        id: 'lillah',
        title: "Lillah (For the Sake of Allah)",
        description: "Lillah is a type of voluntary Sadaqah. While \"Sadaqah\" often refers to helping individuals, \"Lillah\" is typically used to denote donations intended for institutions.",
        usage: "It is primarily used for the construction and maintenance of mosques, schools (Madrasas), hospitals, and other community infrastructure.",
        keyUse: "Unlike Zakat, Lillah can be used to cover the running costs (utilities, staff salaries) of Islamic institutions.",
    },
    {
        id: 'interest',
        title: "Interest (Riba/Bank Interest)",
        description: "In Islam, taking or giving interest is forbidden (Haram). If interest is accumulated in a bank account, it must be disposed of to avoid utilizing it for personal benefit.",
        usage: "It must be given away to charity without the intention of reward.",
        application: "It is commonly used for public utility projects that do not have a direct spiritual component, such as building public toilets, repairing roads, or providing generic relief to the poor.",
    }
];
