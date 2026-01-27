import { Member } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Handle negative years: -0256-01-01
  // Split considering the first char might be '-'
  const isBC = dateStr.startsWith("-");
  if (isBC) {
    // Remove first '-' then split
    const parts = dateStr.substring(1).split("-");
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

export function getAge(
  birthDate?: string,
  deathDate?: string,
  currentYear?: number,
): number | null {
  if (!birthDate) return null;

  const birth = parseDate(birthDate);
  const end = deathDate
    ? parseDate(deathDate)
    : currentYear
      ? new Date(currentYear, 0, 1)
      : new Date();

  let age = end.getFullYear() - birth.getFullYear();
  const m = end.getMonth() - birth.getMonth();

  // If not yet reached birthday in the end year
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
    age--;
  }

  // If birth date is in future relative to end date (e.g. currentYear timeline)
  if (birth.getTime() > end.getTime()) {
    return null; // Unborn or invalid
  }

  return age >= 0 ? age : null;
}

export function getSurname(name: string): string {
  if (!name) return "";
  // Simple heuristic: First character for Chinese names, or first word for others
  // If Chinese characters detected (Unicode range \u4e00-\u9fa5)
  if (/[\u4e00-\u9fa5]/.test(name)) {
    return name.charAt(0);
  }
  return name.split(" ")[0]; // Western style: First Name as surname? No, usually Last Name.
  // But user requirement says "First Chinese character".
  // For western names, maybe just return full name or let user edit.
  // The requirement specifically mentions "auto identify surname as first hanzi".
}

export function getMemberStatus(
  member: Member,
  currentYear?: number,
): "living" | "deceased" | "unborn" {
  const now = currentYear ? new Date(currentYear, 0, 1) : new Date();

  if (member.birth_date) {
    const birth = parseDate(member.birth_date);
    if (birth.getTime() > now.getTime()) {
      return "unborn";
    }
  }

  if (member.death_date) {
    const death = parseDate(member.death_date);
    if (death.getTime() <= now.getTime()) {
      return "deceased";
    }
    // If death date is in future relative to timeline, they are living (conceptually)
    // unless birth date is also in future.
  } else if (member.is_deceased) {
    // If explicitly marked as deceased (and no death date, or we rely on flag)
    // We assume they are deceased unless timeline is before their birth?
    // If timeline is enabled, `is_deceased` flag might be ambiguous without a date.
    // We'll assume if `is_deceased` is true, they are deceased regardless of timeline
    // unless timeline is before birth.
    return "deceased";
  }

  return "living";
}
