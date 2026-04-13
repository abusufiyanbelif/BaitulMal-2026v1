import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    return new Intl.DateTimeFormat('en-IN', options || defaultOptions).format(date);
}
