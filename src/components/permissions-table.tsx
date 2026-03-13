'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { modules, type UserPermissions, type Permission } from '@/lib/modules';
import { getNestedValue, cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

  /**
   * Renders a single row in the permissions table.
   */
  const renderRow = (label: string, path: string, level: number = 0, allowedPerms: Permission[]) => {
    return (
      <TableRow key={path} className={cn(
        "transition-colors",
        level > 0 ? "bg-primary/[0.01] border-l-2 border-primary/10" : "bg-white"
      )}>
        <TableCell className={cn(
            "font-bold text-primary py-3", 
            level > 0 && "pl-8 text-xs text-muted-foreground font-normal italic"
        )}>
          {level > 0 && "↳ "} {label}
        </TableCell>
        
        {(['create', 'read', 'update', 'delete'] as const).map((p) => {
          const isAllowed = allowedPerms.includes(p);
          const isChecked = isRoleAdmin || !!getNestedValue(permissions, `${path}.${p}`, false);
          
          return (
            <TableCell key={p} className="text-center py-3">
              {isAllowed ? (
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={handleCheckedChange(`${path}.${p}`)}
                  disabled={isDisabled}
                  className="border-primary/40 data-[state=checked]:bg-primary transition-all active:scale-90"
                />
              ) : (
                <span className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-tighter select-none">N/A</span>
              )}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  return (
    <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-white animate-fade-in-up">
      <ScrollArea className="w-full">
        <div className="min-w-[600px]">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent border-b border-primary/10">
                <TableHead className="font-bold text-primary tracking-tight py-4">Module / Section</TableHead>
                <TableHead className="text-center font-bold text-primary tracking-tight py-4">Create</TableHead>
                <TableHead className="text-center font-bold text-primary tracking-tight py-4">Read</TableHead>
                <TableHead className="text-center font-bold text-primary tracking-tight py-4">Update</TableHead>
                <TableHead className="text-center font-bold text-primary tracking-tight py-4">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((mod) => (
                <React.Fragment key={mod.id}>
                  {renderRow(mod.name, mod.id, 0, mod.permissions as unknown as Permission[])}
                  {('subModules' in mod && mod.subModules) && (mod.subModules as any).map((subMod: any) => (
                    renderRow(subMod.name, `${mod.id}.${subMod.id}`, 1, subMod.permissions as unknown as Permission[])
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
