import { getNestedValue, set } from "./utils";

export const crudPermissions = ['create', 'read', 'update', 'delete'] as const;
export const readUpdatePermissions = ['read', 'update'] as const;
export const simpleReadPermission = ['read'] as const;
export const donationCategories = ['Zakat', 'Sadaqah', 'Interest', 'Lillah', 'Loan', 'Monthly Contribution'] as const;

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

export const leadPurposesConfig = [
  { id: 'Education', name: 'Education', categories: ['School Fees', 'College Fees', 'Tuition Fees', 'Exam Fees', 'Hostel Fees', 'Books & Uniforms', 'Educational Materials', 'Other'] },
  { id: 'Medical', name: 'Medical', categories: ['Hospital Bill', 'Doctor Fees', 'Medication', 'Surgery', 'Other'] },
  { id: 'Ration', name: 'Ration', categories: [] as string[] },
  { id: 'Relief', name: 'Relief', categories: [] as string[] },
  { id: 'General', name: 'General', categories: [] as string[] },
  { id: 'Other', name: 'Other', categories: [] as string[] },
] as const;

export const leadSeriousnessLevels = ['High', 'Moderate', 'Low'] as const;

export const modules = [
  { id: 'users', name: 'User Management', permissions: crudPermissions },
  {
    id: 'campaigns',
    name: 'Campaigns',
    permissions: ['create', 'read', 'update', 'delete'] as const,
    subModules: campaignSubModules,
  },
  { id: 'donations', name: 'Donations', permissions: crudPermissions },
  {
    id: 'leads-members',
    name: 'Leads',
    permissions: ['create', 'read', 'update', 'delete'] as const,
    subModules: leadSubModules,
  },
  { id: 'extractor', name: 'Extractor', permissions: simpleReadPermission },
  { id: 'storyCreator', name: 'Story Creator', permissions: simpleReadPermission },
  { id: 'diagnostics', name: 'Diagnostics', permissions: simpleReadPermission },
  { id: 'settings', name: 'Settings', permissions: readUpdatePermissions },
] as const;

export const permissions = ['create', 'read', 'update', 'delete'] as const;

export type ModuleId = typeof modules[number]['id'];
export type Permission = typeof permissions[number];

type SubModulePermissions<T extends Readonly<any[]>> = {
  [K in T[number]['id']]?: Partial<Record<T[number]['permissions'][number], boolean>>;
};

type CampaignPermissions = Partial<Record<Permission, boolean>> & SubModulePermissions<typeof campaignSubModules>;
type LeadPermissions = Partial<Record<"create" | "read" | "update" | "delete", boolean>> & SubModulePermissions<typeof leadSubModules>;


export type UserPermissions = Partial<
  Record<Exclude<ModuleId, 'campaigns' | 'leads-members'>, Partial<Record<Permission, boolean>>>
> & {
  campaigns?: CampaignPermissions;
  'leads-members'?: LeadPermissions;
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
