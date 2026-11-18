import { db } from "@/lib/db";
import { getPublisher } from "@/lib/publishers";
import type { ProductSnapshot } from "@/lib/publishers/types";

export type ReleaseDetails = {
  id: string;
  key: string;
  url: string;
  name: string;
  publisher: string;
  coverUrl: string | null;
  pricePence: number | null;
};

/**
 * Saves the cover when it's new or has changed, and fetches the price once per
 * release (prices rarely change and need a second request). Used by the poller
 * on every stock check and by the monitor to fill in releases still missing them.
 * Never throws: missing details shouldn't stop a stock check.
 *
 * Returns what was saved.
 */
export async function saveProductDetails(
  release: ReleaseDetails,
  page: Pick<ProductSnapshot, "coverUrl">,
): Promise<{ coverUrl?: string; pricePence?: number }> {
  const data: { coverUrl?: string; pricePence?: number } = {};
  if (page.coverUrl && page.coverUrl !== release.coverUrl) data.coverUrl = page.coverUrl;

  if (release.pricePence === null) {
    try {
      const pricePence = await getPublisher(release.publisher).fetchPrice(release);
      if (pricePence !== null) data.pricePence = pricePence;
    } catch (err) {
      console.error(`Failed to fetch the price for release ${release.key}:`, err);
    }
  }

  if (Object.keys(data).length > 0) {
    try {
      await db.release.update({ where: { id: release.id }, data });
    } catch (err) {
      console.error(`Failed to save product details for release ${release.key}:`, err);
      return {};
    }
  }
  return data;
}
