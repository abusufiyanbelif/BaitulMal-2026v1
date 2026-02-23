

import { getNestedValue, set } from "./utils";

export const crudPermissions = ['create', 'read', 'update', 'delete'] as const;
export const readUpdatePermissions = ['read', 'update'] as const;
export const simpleReadPermission = ['read'] as const;
export const donationCategories = ['Fitra', 'Zakat', 'Sadaqah', 'Interest', 'Lillah', 'Loan', 'Monthly Contribution'] as const;

export const GROUPS = [
    { id: 'founder', name: 'Founders' },
    { id: 'co-founder', name: 'Co-Founders' },
    { id: 'finance', name: 'Finance Team' },
    { id: 'member', name: 'Members' },
] as const;

export type GroupId = typeof GROUPS[number]['id'];
export const GROUP_IDS = GROUPS.map(g => g.id);


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
    { id: 'app', name: 'App Settings', permissions: readUpdatePermissions },
    { id: 'members', name: 'Organization Members', permissions: readUpdatePermissions },
    { id: 'campaign', name: 'Campaign Settings', permissions: readUpdatePermissions },
    { id: 'lead', name: 'Lead Settings', permissions: readUpdatePermissions },
    { id: 'donation', name: 'Donation Settings', permissions: readUpdatePermissions },
    { id: 'beneficiary', name: 'Beneficiary Settings', permissions: readUpdatePermissions },
    { id: 'user', name: 'User Settings', permissions: readUpdatePermissions },
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
    permissions: ['create', 'read', 'update', 'delete'] as const,
    subModules: campaignSubModules,
  },
  {
    id: 'leads-members',
    name: 'Leads',
    permissions: ['create', 'read', 'update', 'delete'] as const,
    subModules: leadSubModules,
  },
  { id: 'beneficiaries', name: 'Beneficiaries', permissions: crudPermissions },
  { id: 'donations', name: 'Donations', permissions: crudPermissions },
  { id: 'extractor', name: 'Extractor', permissions: simpleReadPermission },
  { id: 'storyCreator', name: 'Story Creator', permissions: simpleReadPermission },
  { id: 'diagnostics', name: 'Diagnostics', permissions: simpleReadPermission },
  { 
    id: 'settings', 
    name: 'Settings', 
    permissions: readUpdatePermissions,
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
type LeadPermissions = Partial<Record<"create" | "read" | "update" | "delete", boolean>> & SubModulePermissions<typeof leadSubModules>;
type SettingsPermissions = Partial<Record<"read" | "update", boolean>> & SubModulePermissions<typeof settingsSubModules>;


export type UserPermissions = Partial<
  Record<Exclude<ModuleId, 'campaigns' | 'leads-members' | 'settings'>, Partial<Record<Permission, boolean>>>
> & {
  campaigns?: CampaignPermissions;
  'leads-members'?: LeadPermissions;
  beneficiaries?: Partial<Record<Permission, boolean>>;
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
