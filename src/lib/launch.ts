import { DateTime } from "luxon";

const UK_TIMEZONE = "Europe/London";
// Super Rare Games releases go on sale at 6pm UK time.
const STOCK_LIVE_HOUR = 18;
// The poller starts checking a few minutes early, at 17:55.
const LAUNCH_POLL_START_MINUTES = 17 * 60 + 55;

/** When the poller starts checking a release's stock. */
export function getReleaseLaunchAt(releaseDate: Date, preOrderCloseDate: Date | null): Date {
  // If preOrderCloseDate is set, stock % is not set until this time.
  if (preOrderCloseDate) {
    return DateTime.fromJSDate(preOrderCloseDate, { zone: UK_TIMEZONE }).toJSDate();
  }

  const launchHour = Math.floor(LAUNCH_POLL_START_MINUTES / 60);
  const launchMinute = LAUNCH_POLL_START_MINUTES % 60;
  const releaseDay = DateTime.fromJSDate(releaseDate, { zone: UK_TIMEZONE });
  return releaseDay.set({ hour: launchHour, minute: launchMinute, second: 0, millisecond: 0 }).toJSDate();
}

/** When stock goes on sale, as the store announces it. Shown as "Stock goes live 12 Nov, 18:00". */
export function getStockLiveAt(releaseDate: Date, preOrderCloseDate: Date | null): Date {
  if (preOrderCloseDate) return preOrderCloseDate;
  const releaseDay = DateTime.fromJSDate(releaseDate, { zone: UK_TIMEZONE });
  return releaseDay.set({ hour: STOCK_LIVE_HOUR, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}
