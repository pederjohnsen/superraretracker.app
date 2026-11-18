import { DateTime } from "luxon";
import type { MonitorFindings, NewRelease, Publisher } from "@/lib/publishers/types";
import { LOST_IN_CULT_CONFIG as CONFIG } from "./config";
import { findEditions, releaseKey, releaseName } from "./editions";
import { parsePrintRuns, percentageLeft, printRunFor } from "./print-run";
import { coverUrl, fetchProduct, fetchProductText, fetchShopProducts, pricePence } from "./store";

// Lost in Cult sells limited EDITIONs of indie games alongside open Retail
// versions, as options of one product. Each EDITION option is its own release.
// The store gives exact copies left; the card shows them as a % of the print
// run stated in the description, or as a count when that can't be found.

export const lostInCult: Publisher = {
  key: "lost-in-cult",
  name: "Lost in Cult",
  storeUrl: CONFIG.storeUrl,
  currency: "GBP",
  // Editions go on sale as soon as they're listed, so stock is live from the
  // start of the day they're published (their `releaseDate`).
  launch: { timeZone: "Europe/London", hour: 0, minute: 0, pollLeadMinutes: 0 },

  async readProduct(release) {
    const product = await fetchProduct(release.url);
    const variant = product.variants?.find((option) => option.id === release.variantId);
    if (!variant) throw new Error(`Option ${release.variantId ?? "(none)"} not found on ${release.url}`);
    // An option the store doesn't count has no stock level to show.
    const stockCount = variant.unlimited ? null : Math.max(0, variant.qtyInStock);
    return {
      stockPercentage: stockCount !== null && release.printRun ? percentageLeft(stockCount, release.printRun) : null,
      stockCount,
      coverUrl: coverUrl(product, variant),
    };
  },

  async fetchPrice(release) {
    const product = await fetchProduct(release.url);
    return pricePence(product.variants?.find((option) => option.id === release.variantId));
  },

  async getDisplayParts(release) {
    // Names are saved as "Title – PS5 EDITION"; the platform has its own badge.
    return { title: release.name.split(" – ")[0].trim(), catalogue: null, edition: "EDITION" };
  },

  async findNewReleases({ isKnown, maxAgeDays, now }) {
    const findings: MonitorFindings = { releases: [], skipped: [], errors: [] };
    let products;
    try {
      products = await fetchShopProducts();
    } catch (err) {
      findings.errors.push(err instanceof Error ? err.message : String(err));
      return findings;
    }

    const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
    for (const product of products) {
      if (!product.publishOn || product.publishOn < cutoff) continue;
      const editions = findEditions(product);
      // Soundtracks, books, merch and the like have no EDITION option, so they're not listed as skipped.
      if (editions.length === 0) continue;
      const newEditions = editions.filter((edition) => !isKnown(releaseKey(product, edition)));
      if (newEditions.length === 0) continue;

      const skip = (key: string, reason: string) => findings.skipped.push({ key, title: product.title, reason });
      if (CONFIG.skipTitles.some((pattern) => pattern.test(product.title))) {
        for (const edition of newEditions) skip(releaseKey(product, edition), "Bundle: its stock is separate from the edition's print run");
        continue;
      }

      const url = new URL(product.fullUrl, CONFIG.storeUrl).toString();
      // The print runs are only in the page's description, so read it once per product.
      let runs = null;
      try {
        runs = parsePrintRuns(await fetchProductText(url));
      } catch (err) {
        findings.errors.push(`${product.title}: couldn't read the description (${err instanceof Error ? err.message : String(err)})`);
      }

      for (const edition of newEditions) {
        const key = releaseKey(product, edition);
        if (edition.variant.unlimited) {
          skip(key, "The store isn't counting this edition's stock yet");
          continue;
        }
        const release: NewRelease = {
          key,
          name: releaseName(product, edition),
          url,
          type: edition.type,
          releaseDate: DateTime.fromMillis(product.publishOn, { zone: "Europe/London" }).startOf("day").toJSDate(),
          releaseDateFrom: "published",
          title: product.title.trim(),
          catalogue: null,
          edition: "EDITION",
          variantId: edition.variant.id,
          printRun: runs ? printRunFor(runs, edition.type, editions.map((other) => other.type)) : null,
        };
        findings.releases.push(release);
      }
    }
    return findings;
  },
};
