import { DateTime } from "luxon";
import type { Publisher } from "@/lib/publishers/types";

// Launch times come from each publisher: Super Rare Games goes on sale at 6pm
// UK time on release day, and the poller starts a few minutes before.

type Launch = Publisher["launch"];

/** When stock goes on sale, as the store announces it. Shown as "Stock goes live 12 Nov, 18:00". */
export function getStockLiveAt(launch: Launch, releaseDate: Date, preOrderCloseDate: Date | null): Date {
  if (preOrderCloseDate) return preOrderCloseDate;
  const releaseDay = DateTime.fromJSDate(releaseDate, { zone: launch.timeZone });
  return releaseDay.set({ hour: launch.hour, minute: launch.minute, second: 0, millisecond: 0 }).toJSDate();
}

/** When the poller starts checking a release's stock. */
export function getReleaseLaunchAt(launch: Launch, releaseDate: Date, preOrderCloseDate: Date | null): Date {
  // With a pre-order close date, stock % isn't set until then.
  if (preOrderCloseDate) return preOrderCloseDate;
  return DateTime.fromJSDate(getStockLiveAt(launch, releaseDate, null))
    .minus({ minutes: launch.pollLeadMinutes })
    .toJSDate();
}
