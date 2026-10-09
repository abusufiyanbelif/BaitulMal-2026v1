'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsSectionProps {
    title: string;
    description?: string;
    icon?: any;
    children: React.ReactNode;
    defaultOpen?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    badge?: React.ReactNode;
    headerActions?: React.ReactNode;
    className?: string;
}

export function SettingsSection({
    title,
    description,
    icon: Icon,
    children,
    defaultOpen = false,
    isOpen: controlledIsOpen,
    onOpenChange: controlledOnOpenChange,
    badge,
    headerActions,
    className
}: SettingsSectionProps) {
    const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    const handleOpenChange = (open: boolean) => {
        if (!isControlled) {
            setInternalIsOpen(open);
        }
        controlledOnOpenChange?.(open);
    };

    return (
        <Collapsible open={isOpen} onOpenChange={handleOpenChange} className={cn("w-full animate-fade-in-up", className)}>
            <Card className="rounded-[24px] border border-primary/10 shadow-sm overflow-hidden bg-card transition-all hover:shadow-md">
                <CollapsibleTrigger asChild>
                    <CardHeader className="p-6 cursor-pointer hover:bg-primary/[0.02] transition-colors group select-none">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                {Icon && (
                                    <div className="p-3 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner shrink-0">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <CardTitle className="text-lg font-bold text-primary tracking-tight">{title}</CardTitle>
                                        {badge}
                                    </div>
                                    {description && (
                                        <CardDescription className="text-xs font-normal text-muted-foreground leading-snug">{description}</CardDescription>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {headerActions && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                        {headerActions}
                                    </div>
                                )}
                                <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary transition-transform duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                                    <ChevronDown className={cn("h-5 w-5 transition-transform duration-300", isOpen && "rotate-180")} />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-6 pb-6 animate-fade-in-up">
                        <Separator className="bg-primary/10 mb-6" />
                        <div className="space-y-6">
                            {children}
                        </div>
                    </div>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
