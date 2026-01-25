import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Handle negative years: -0256-01-01
  // Split considering the first char might be '-'
  const isBC = dateStr.startsWith('-');
  if (isBC) {
      // Remove first '-' then split
      const parts = dateStr.substring(1).split('-');
      if (parts.length >= 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          
          const date = new Date();
          date.setFullYear(-year);
          date.setMonth(month);
          date.setDate(day);
          date.setHours(0, 0, 0, 0);
          return date;
      }
  }
  
  return new Date(dateStr);
}
