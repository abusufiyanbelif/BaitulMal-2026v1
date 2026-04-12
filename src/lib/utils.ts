import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getNestedValue(obj: any, path: string, defaultValue: any = undefined) {
    if (typeof path !== 'string') {
        console.warn('getNestedValue: path must be a string');
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
        console.warn('set: path must be a string');
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
    if (!name) return 'U';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
}

/**
 * Formats a number as Indian Rupee (INR) currency.
 * Professional Title Case standard.
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Formats a date string or object into an institutional standard display.
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
