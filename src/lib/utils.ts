import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely traverses an object to retrieve a nested value.
 */
export function getNestedValue(obj: any, path: string, defaultValue: any = undefined) {
    if (typeof path !== 'string') {
        console.warn('getNestedValue: Path Must Be A String.');
        return defaultValue;
    }
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        result = result?.[key];
        if (result === undefined) {
            return defaultValue;
        }
    }
    return result;
}

/**
 * Safely sets a nested value within an object, creating intermediaries as needed.
 */
export function set(obj: any, path: string, value: any) {
    if (typeof path !== 'string') {
        console.warn('set: Path Must Be A String.');
        return obj;
    }
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
}

/**
 * Extracts initials from a name for avatar fallbacks.
 */
export function getInitials(name: string | null | undefined): string {
    if (!name || name.trim().length === 0) return 'U';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
}

/**
 * Formats A Number As Indian Rupee (INR) Currency.
 */
export function formatCurrency(amount: number | null | undefined): string {
    const val = amount ?? 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(val);
}

/**
 * Formats A Date String Or Object Into An Institutional Standard Display.
 */
export function formatDate(dateInput: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!dateInput) return 'N/A';
    
    let date: Date;
    if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput && typeof (dateInput as any).toDate === 'function') {
        // Handle Firestore Timestamp
        date = (dateInput as any).toDate();
    } else {
        date = dateInput as Date;
    }

    if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    return new Intl.DateTimeFormat('en-IN', options || defaultOptions).format(date);
}

/**
 * Helper to generate a change list from two objects.
 */
export function generateChanges(oldVal: any, newVal: any): { field: string, old: any, new: any }[] {
    const changes: { field: string, old: any, new: any }[] = [];
    
    // If both are missing, no changes
    if (!oldVal && !newVal) return changes;

    // Handle CREATE scenario: Everything in newVal is a change from N/A
    if (!oldVal && newVal) {
        Object.keys(newVal).forEach(key => {
            if (['updatedAt', 'createdAt', 'id', 'assignedVerifiers', 'assignedVerifierIds', 'requestedBy', 'status', 'module', 'targetId', 'targetCollection', 'revalidatePath'].includes(key)) return;
            changes.push({
                field: key,
                old: 'N/A',
                new: newVal[key]
            });
        });
        return changes;
    }

    // Handle DELETE scenario: Everything in oldVal is a change to N/A
    if (oldVal && !newVal) {
        Object.keys(oldVal).forEach(key => {
            if (['updatedAt', 'createdAt', 'id', 'assignedVerifiers', 'assignedVerifierIds', 'requestedBy', 'status', 'module', 'targetId', 'targetCollection', 'revalidatePath'].includes(key)) return;
            changes.push({
                field: key,
                old: oldVal[key],
                new: 'DELETED'
            });
        });
        return changes;
    }

    const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
    
    for (const key of allKeys) {
        if (['updatedAt', 'createdAt', 'id', 'assignedVerifiers', 'assignedVerifierIds', 'requestedBy', 'status', 'module', 'targetId', 'targetCollection', 'revalidatePath'].includes(key)) continue;
        
        const oldValStr = JSON.stringify(oldVal[key]);
        const newValStr = JSON.stringify(newVal[key]);
        
        if (oldValStr !== newValStr) {
            changes.push({
                field: key,
                old: oldVal[key] ?? 'N/A',
                new: newVal[key] ?? 'N/A'
            });
        }
    }
    
    return changes;
}

/**
 * Resolves an image source URL, bypassing the proxy for local assets
 * while routing remote URLs through the institutional proxy for compatibility.
 */
export function getImageSrc(url: string | null | undefined): string {
    if (!url) return '';
    
    // If it's a local asset (starts with /), return as is
    if (url.startsWith('/')) {
        return url;
    }
    
    // If it's an external URL, route through the proxy
    if (url.startsWith('http')) {
        return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    return url;
}

