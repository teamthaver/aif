import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Safe for the browser. Server-only helpers live in lib/server-utils.ts
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
