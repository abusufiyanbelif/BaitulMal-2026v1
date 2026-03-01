
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserPermissions } from '@/lib/modules';
import { getNestedValue } from '@/lib/utils';

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
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'campaigns.read', false)}
                onCheckedChange={handleCheckedChange('campaigns.read')}
                disabled={isDisabled}
              />
            </TableCell>
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
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'leads-members.read', false)}
                onCheckedChange={handleCheckedChange('leads-members.read')}
                disabled={isDisabled}
              />
            </TableCell>
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
          
          {/* Beneficiaries */}
          <TableRow>
            <TableCell className="font-medium">Beneficiaries (Master)</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'beneficiaries.create', false)}
                onCheckedChange={handleCheckedChange('beneficiaries.create')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'beneficiaries.read', false)}
                onCheckedChange={handleCheckedChange('beneficiaries.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'beneficiaries.update', false)}
                onCheckedChange={handleCheckedChange('beneficiaries.update')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'beneficiaries.delete', false)}
                onCheckedChange={handleCheckedChange('beneficiaries.delete')}
                disabled={isDisabled}
              />
            </TableCell>
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

          {/* Settings */}
          <TableRow>
            <TableCell className="font-medium">Settings</TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'settings.create', false)}
                onCheckedChange={handleCheckedChange('settings.create')}
                disabled={isDisabled}
              />
            </TableCell>
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
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'settings.delete', false)}
                onCheckedChange={handleCheckedChange('settings.delete')}
                disabled={isDisabled}
              />
            </TableCell>
          </TableRow>

          {/* Read-Only Access Modules */}
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
            <TableCell className="font-medium">Data Analytics</TableCell>
            <TableCell />
            <TableCell className="text-center">
              <Checkbox
                checked={!!getNestedValue(permissions, 'analytics.read', false)}
                onCheckedChange={handleCheckedChange('analytics.read')}
                disabled={isDisabled}
              />
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
