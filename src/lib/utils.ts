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
