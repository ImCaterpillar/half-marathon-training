import { getAppTimezone } from "@/lib/env";

export function formatServerTime(timeZone = getAppTimezone()) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function getTodayDateInTimezone(timeZone = getAppTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateString: string, days: number) {
  const date = parseDateOnly(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

export function startOfWeekMonday(dateString: string) {
  const date = parseDateOnly(dateString);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return toDateOnly(date);
}

export function endOfWeekSunday(dateString: string) {
  return addDays(startOfWeekMonday(dateString), 6);
}

export function startOfMonth(dateString: string) {
  const date = parseDateOnly(dateString);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function endOfMonth(dateString: string) {
  const date = parseDateOnly(startOfMonth(dateString));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return toDateOnly(date);
}

export function daysBetween(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate).getTime();
  const end = parseDateOnly(endDate).getTime();
  return Math.ceil((end - start) / 86_400_000);
}

export function isBetweenDateOnly(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function dayLabel(dateString: string) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(parseDateOnly(dateString));
}
