import { getNestedValue, set } from "./utils";

export const crudPermissions = ['create', 'read', 'update', 'delete'] as const;
export const readUpdatePermissions = ['read', 'update'] as const;
export const simpleReadPermission = ['read'] as const;
export const donationCategories = ['Fitra', 'Zakat', 'Sadaqah', 'Fidiya', 'Interest', 'Lillah', 'Loan', 'Monthly Contribution'] as const;
export const upiProviders = ['Google Pay', 'PhonePe', 'Paytm', 'Amazon Pay', 'BHIM UPI', 'Other'] as const;
export const supportedBanks = [
    'State Bank of India (SBI)',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'IndusInd Bank',
    'Bank of Baroda (BOI)',
    'Punjab National Bank (PNB)',
    'Union Bank of India',
    'Canara Bank',
    'Other'
] as const;

export const GROUPS = [
    { id: 'founder', name: 'Founders' },
    { id: 'co-founder', name: 'Co-Founders' },
    { id: 'finance', name: 'Finance Team' },
    { id: 'member', name: 'Members' },
] as const;

export type GroupId = typeof GROUPS[number]['id'];
export const GROUP_IDS = GROUPS.map(g => g.id);

export const priorityLevels = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type PriorityLevel = typeof priorityLevels[number];

export type DonationCategory = typeof donationCategories[number];
export type CrudPermissions = typeof crudPermissions;
export type ReadUpdatePermissions = typeof readUpdatePermissions;
export type SimpleReadPermission = typeof simpleReadPermission;

export const campaignSubModules = [
  { id: 'summary', name: 'Summary', permissions: readUpdatePermissions },
  { id: 'ration', name: 'Ration Details', permissions: readUpdatePermissions },
  { id: 'beneficiaries', name: 'Beneficiary List', permissions: crudPermissions },
  { id: 'donations', name: 'Donations', permissions: crudPermissions },
] as const;

export const leadSubModules = [
  { id: 'summary', name: 'Summary', permissions: readUpdatePermissions },
  { id: 'beneficiaries', name: 'Beneficiary List', permissions: crudPermissions },
  { id: 'donations', name: 'Donations', permissions: crudPermissions },
] as const;

export const settingsSubModules = [
    { id: 'app', name: 'App Settings', permissions: crudPermissions },
    { id: 'members', name: 'Organization Members', permissions: crudPermissions },
    { id: 'info', name: 'Info Pages', permissions: crudPermissions },
    { id: 'guidance', name: 'Guidance Settings', permissions: crudPermissions },
    { id: 'viewport', name: 'Display & UI', permissions: crudPermissions },
    { id: 'campaign', name: 'Campaign Settings', permissions: crudPermissions },
    { id: 'lead', name: 'Lead Settings', permissions: crudPermissions },
    { id: 'donation', name: 'Donation Settings', permissions: crudPermissions },
    { id: 'beneficiary', name: 'Beneficiary Settings', permissions: crudPermissions },
    { id: 'donor', name: 'Donor Settings', permissions: crudPermissions },
    { id: 'user', name: 'User Settings', permissions: crudPermissions },
    { id: 'data-health', name: '🩺 Data Health', permissions: simpleReadPermission },
] as const;

export const leadPurposesConfig = [
  { id: 'Education', name: 'Education', categories: ['School Fees', 'College Fees', 'Tuition Fees', 'Exam Fees', 'Hostel Fees', 'Books & Uniforms', 'Educational Materials', 'Other'] },
  { id: 'Medical', name: 'Medical', categories: ['Hospital Bill', 'Doctor Fees', 'Medication', 'Surgery', 'Other'] },
  { id: 'Relief', name: 'Relief Fund', categories: ['Ration Kit', 'Financial Aid', 'Disaster Relief', 'Shelter Assistance', 'Utility Bill Payment', 'Other'] },
  { id: 'General', name: 'General', categories: [] as string[] },
  { id: 'Other', name: 'Other', categories: [] as string[] },
] as const;

export const leadSeriousnessLevels = ['High', 'Moderate', 'Low'] as const;

export const educationDegrees = [
  'SSC',
  'HSC',
  'B.A.',
  'B.Com.',
  'B.Sc.',
  'B.E.',
  'MBBS',
  'B.Pharm',
  'D.Pharm',
  'BUMS',
  'BHMS',
  'M.A.',
  'M.Com.',
  'M.Sc.',
  'M.E.',
  'Diploma',
  'Other',
] as const;

export const educationYears = [
  'First Year', 'Second Year', 'Third Year', 'Final Year', 'Other'
] as const;

export const educationSemesters = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', 'Annual', 'Other'
] as const;

export const modules = [
  { id: 'users', name: 'User Management', permissions: crudPermissions },
  {
    id: 'campaigns',
    name: 'Campaigns',
    permissions: crudPermissions,
    subModules: campaignSubModules,
  },
  {
    id: 'leads-members',
    name: 'Leads',
    permissions: crudPermissions,
    subModules: leadSubModules,
  },
  { id: 'beneficiaries', name: 'Beneficiaries', permissions: crudPermissions },
  { id: 'donations', name: 'Donations', permissions: crudPermissions },
  { id: 'donors', name: 'Donors', permissions: crudPermissions },
  { id: 'guidance', name: 'Guidance Hub', permissions: crudPermissions },
  { id: 'extractor', name: 'Extractor', permissions: simpleReadPermission },
  { id: 'storyCreator', name: 'Story Creator', permissions: simpleReadPermission },
  { id: 'diagnostics', name: 'Diagnostics', permissions: simpleReadPermission },
  { id: 'analytics', name: 'Data Analytics', permissions: simpleReadPermission },
  { 
    id: 'settings', 
    name: 'Settings', 
    permissions: crudPermissions,
    subModules: settingsSubModules,
  },
] as const;

export const permissions = ['create', 'read', 'update', 'delete'] as const;

export type ModuleId = typeof modules[number]['id'];
export type Permission = typeof permissions[number];

type SubModulePermissions<T extends Readonly<any[]>> = {
  [K in T[number]['id']]?: Partial<Record<T[number]['permissions'][number], boolean>>;
};

type CampaignPermissions = Partial<Record<Permission, boolean>> & SubModulePermissions<typeof campaignSubModules>;
type LeadPermissions = Partial<Record<Permission, boolean>> & SubModulePermissions<typeof leadSubModules>;
type SettingsPermissions = Partial<Record<Permission, boolean>> & SubModulePermissions<typeof settingsSubModules>;


export type UserPermissions = Partial<
  Record<Exclude<ModuleId, 'campaigns' | 'leads-members' | 'settings'>, Partial<Record<Permission, boolean>>>
> & {
  campaigns?: CampaignPermissions;
  'leads-members'?: LeadPermissions;
  beneficiaries?: Partial<Record<Permission, boolean>>;
  donors?: Partial<Record<Permission, boolean>>;
  guidance?: Partial<Record<Permission, boolean>>;
  settings?: SettingsPermissions;
};


export function createAdminPermissions(): UserPermissions {
  const allPermissions: UserPermissions = {};
  for (const mod of modules) {
    const modId = mod.id;
    for (const perm of mod.permissions) {
      set(allPermissions, `${modId}.${perm}`, true);
    }
    if ('subModules' in mod && mod.subModules) {
      for (const subMod of mod.subModules) {
        for (const subPerm of subMod.permissions) {
          set(allPermissions, `${modId}.${subMod.id}.${subPerm}`, true);
        }
      }
    }
  }
  return allPermissions;
}
