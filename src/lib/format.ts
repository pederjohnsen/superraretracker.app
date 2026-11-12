// Display formats for the release cards. Times are shown in UK time, the
// store's own clock, so "Stock goes live 12 Nov, 18:00" matches its announcements.

const TIME_ZONE = "Europe/London";

const priceFormats = new Map<string, Intl.NumberFormat>();
const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TIME_ZONE });
const dayMonthTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});
const fullDateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: TIME_ZONE });

/** 3720, "GBP" -> "£37.20"; 3499, "EUR" -> "€34.99". */
export function formatPrice(minorUnits: number, currency = "GBP"): string {
  let format = priceFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("en-GB", { style: "currency", currency });
    priceFormats.set(currency, format);
  }
  return format.format(minorUnits / 100);
}

/** "25 Sept 2026" */
export function formatDate(date: Date | string): string {
  return dayMonthYear.format(new Date(date));
}

/** "12 Nov, 18:00" */
export function formatDayTime(date: Date | string): string {
  return dayMonthTime.format(new Date(date));
}

/** For a `title` on hover: "Friday 6 November 2026 at 15:45" */
export function formatFullDateTime(date: Date | string): string {
  return fullDateTime.format(new Date(date));
}

/** "just now", "4 min ago", "2 h ago", then "on 4 Nov" after a day. */
export function formatTimeAgo(date: Date | string, now: number): string {
  const minutes = Math.floor((now - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `on ${dayMonth.format(new Date(date))}`;
}
