
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserPermissions } from '@/lib/modules';
import { getNestedValue } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface PermissionsTableProps {
  permissions: UserPermissions;
  onPermissionChange: (path: string, checked: boolean) => void;
  role: 'Admin' | 'User';
  disabled: boolean;
}

export function PermissionsTable({ permissions, onPermissionChange, role, disabled }: PermissionsTableProps) {
  const isRoleAdmin = role === 'Admin';
  const isDisabled = disabled || isRoleAdmin;

  const handleCheckedChange = (path: string) => (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      onPermissionChange(path, checked);
    }
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead className="text-center">Create</TableHead>
            <TableHead className="text-center">Read</TableHead>
            <TableHead className="text-center">Update</TableHead>
            <TableHead className="text-center">Delete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* User Management */}
          <TableRow>
            <TableCell className="font-medium">User Management</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'users.create', false)}
                onCheckedChange={handleCheckedChange('users.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'users.read', false)}
                onCheckedChange={handleCheckedChange('users.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'users.update', false)}
                onCheckedChange={handleCheckedChange('users.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'users.delete', false)}
                onCheckedChange={handleCheckedChange('users.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>
          
          {/* Campaigns */}
          <TableRow>
            <TableCell className="font-medium">Campaigns</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.create', false)}
                onCheckedChange={handleCheckedChange('campaigns.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center text-muted-foreground">--</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.update', false)}
                onCheckedChange={handleCheckedChange('campaigns.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.delete', false)}
                onCheckedChange={handleCheckedChange('campaigns.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>
          
          {/* Campaign Submodules */}
          <TableRow key="campaigns-summary" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Summary</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.summary.read', false)}
                onCheckedChange={handleCheckedChange('campaigns.summary.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.summary.update', false)}
                onCheckedChange={handleCheckedChange('campaigns.summary.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
          </TableRow>
          <TableRow key="campaigns-ration" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Ration Details</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.ration.read', false)}
                onCheckedChange={handleCheckedChange('campaigns.ration.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.ration.update', false)}
                onCheckedChange={handleCheckedChange('campaigns.ration.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
          </TableRow>
          <TableRow key="campaigns-beneficiaries" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Beneficiary List</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.beneficiaries.create', false)}
                onCheckedChange={handleCheckedChange('campaigns.beneficiaries.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.beneficiaries.read', false)}
                onCheckedChange={handleCheckedChange('campaigns.beneficiaries.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.beneficiaries.update', false)}
                onCheckedChange={handleCheckedChange('campaigns.beneficiaries.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.beneficiaries.delete', false)}
                onCheckedChange={handleCheckedChange('campaigns.beneficiaries.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>
          <TableRow key="campaigns-donations" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Donations</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.donations.create', false)}
                onCheckedChange={handleCheckedChange('campaigns.donations.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.donations.read', false)}
                onCheckedChange={handleCheckedChange('campaigns.donations.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.donations.update', false)}
                onCheckedChange={handleCheckedChange('campaigns.donations.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.donations.delete', false)}
                onCheckedChange={handleCheckedChange('campaigns.donations.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>

          {/* Spacer Row */}
          <TableRow>
            <TableCell colSpan={5} className="p-0 h-2 bg-background"></TableCell>
          </TableRow>

          {/* Leads */}
          <TableRow>
            <TableCell className="font-medium">Leads</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.create', false)}
                onCheckedChange={handleCheckedChange('leads-members.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center text-muted-foreground">--</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.update', false)}
                onCheckedChange={handleCheckedChange('leads-members.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.delete', false)}
                onCheckedChange={handleCheckedChange('leads-members.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>
          
           {/* Lead Submodules */}
          <TableRow key="leads-summary" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Summary</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.summary.read', false)}
                onCheckedChange={handleCheckedChange('leads-members.summary.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.summary.update', false)}
                onCheckedChange={handleCheckedChange('leads-members.summary.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
          </TableRow>
          <TableRow key="leads-beneficiaries" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Beneficiary List</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.beneficiaries.create', false)}
                onCheckedChange={handleCheckedChange('leads-members.beneficiaries.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.beneficiaries.read', false)}
                onCheckedChange={handleCheckedChange('leads-members.beneficiaries.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.beneficiaries.update', false)}
                onCheckedChange={handleCheckedChange('leads-members.beneficiaries.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.beneficiaries.delete', false)}
                onCheckedChange={handleCheckedChange('leads-members.beneficiaries.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>
          <TableRow key="leads-donations" className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-12 text-muted-foreground">Donations</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.donations.create', false)}
                onCheckedChange={handleCheckedChange('leads-members.donations.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.donations.read', false)}
                onCheckedChange={handleCheckedChange('leads-members.donations.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.donations.update', false)}
                onCheckedChange={handleCheckedChange('leads-members.donations.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.donations.delete', false)}
                onCheckedChange={handleCheckedChange('leads-members.donations.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>

          {/* Spacer Row */}
          <TableRow>
            <TableCell colSpan={5} className="p-0 h-2 bg-background"></TableCell>
          </TableRow>
          
          {/* Global Donations */}
          <TableRow>
            <TableCell className="font-medium">Donations (Global)</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'donations.create', false)}
                onCheckedChange={handleCheckedChange('donations.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'donations.read', false)}
                onCheckedChange={handleCheckedChange('donations.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'donations.update', false)}
                onCheckedChange={handleCheckedChange('donations.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'donations.delete', false)}
                onCheckedChange={handleCheckedChange('donations.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>

          {/* Other Modules */}
          <TableRow>
            <TableCell className="font-medium">Extractor</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'extractor.read', false)}
                onCheckedChange={handleCheckedChange('extractor.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Story Creator</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'storyCreator.read', false)}
                onCheckedChange={handleCheckedChange('storyCreator.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
           <TableRow>
            <TableCell className="font-medium">Diagnostics</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'diagnostics.read', false)}
                onCheckedChange={handleCheckedChange('diagnostics.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Settings</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'settings.read', false)}
                onCheckedChange={handleCheckedChange('settings.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'settings.update', false)}
                onCheckedChange={handleCheckedChange('settings.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
