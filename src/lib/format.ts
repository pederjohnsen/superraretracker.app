// Display formats for the release cards. Times are shown in UK time, the
// store's own clock, so "Stock goes live 12 Nov, 18:00" matches its announcements.

const TIME_ZONE = "Europe/London";

const priceFormat = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
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

/** 3720 -> "£37.20" */
export function formatPrice(pence: number): string {
  return priceFormat.format(pence / 100);
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
