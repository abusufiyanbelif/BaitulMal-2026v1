import type { GuidingPrinciplesData } from './types';

export const defaultGuidingPrinciples: GuidingPrinciplesData = {
  title: "Our Guiding Principles",
  description: "To ensure our operations are transparent, fair, and impactful, we adhere to a clear set of guiding principles. These rules govern how we identify beneficiaries, allocate funds, and manage our resources to best serve the community.",
  principles: [
    { id: 'gp1', text: "Trust is focused on assisting educational and health beneficiaries.", isHidden: false },
    { id: 'gp2', text: "Priority will be given to males studying in their final year of a course.", isHidden: false },
    { id: 'gp3', text: "Assisting orphan girls in all forms except marriage.", isHidden: false },
    { id: 'gp4', text: "Providing ration to the most deserving families in the last week of each month, depending on available funds.", isHidden: false },
    { id: 'gp5', text: "A return agreement will be secured from educational beneficiaries if the amount exceeds ₹25,000.", isHidden: false },
    { id: 'gp6', text: "The maximum capital credited will be ₹40,000, but this can be raised in exceptional cases.", isHidden: false },
  ],
  focusAreas: [
    { 
        id: 'focus_edu', 
        title: "Education", 
        description: "Empowering students through verified fee assistance and academic support to secure a brighter future.",
        icon: 'Education',
        isHidden: false
    },
    { 
        id: 'focus_health', 
        title: "Healthcare", 
        description: "Vetting critical medical cases to provide timely financial aid for surgeries and life-saving treatments.",
        icon: 'Healthcare',
        isHidden: false
    },
    { 
        id: 'focus_relief', 
        title: "Relief Hub", 
        description: "Coordinating monthly ration distributions and emergency relief kits for the most deserving families.",
        icon: 'Relief',
        isHidden: false
    }
  ]
};