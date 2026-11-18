import type { Publisher } from "@/lib/publishers/types";
import { MONITOR_CONFIG } from "./monitor-config";
import { findNewReleases, getDisplayParts } from "./monitor";
import { fetchProductPricePence, fetchProductTags, scrapeProductPage } from "./store";

export const superRareGames: Publisher = {
  key: "super-rare-games",
  name: "Super Rare Games",
  storeUrl: MONITOR_CONFIG.storeUrl,
  currency: "GBP",
  // Releases go on sale at 6pm UK time; the poller starts at 17:55.
  launch: { timeZone: "Europe/London", hour: 18, minute: 0, pollLeadMinutes: 5 },

  async readProduct(release) {
    return scrapeProductPage(release.url);
  },

  async fetchPrice(release) {
    return fetchProductPricePence(release.url);
  },

  async getDisplayParts(release) {
    return getDisplayParts(release.name, await fetchProductTags(release.url));
  },

  findNewReleases(options) {
    return findNewReleases(options);
  },
};
