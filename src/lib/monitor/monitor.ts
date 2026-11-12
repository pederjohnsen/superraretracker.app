import type { ReleaseType } from "../../../zenstack/models";
import { db } from "@/lib/db";
import { saveProductDetails } from "@/lib/product-details";
import { getPublisher, PUBLISHERS } from "@/lib/publishers";
import type { DisplayParts, PublisherKey } from "@/lib/publishers/types";

// Adds new releases from each publisher's store and fills in missing details.
// Run once a day just after the announcements, from /api/monitor. What counts
// as a release, and how to read it, is up to each publisher's module
// (src/lib/publishers/<key>/); this file only saves what they find.

// Releases missing a cover or price filled in per run, a few at a time, so a
// big backlog can't push the request past the function's time limit. The rest
// are picked up on the next run.
const MAX_DETAILS_PER_RUN = 60;
const DETAILS_CONCURRENCY = 4;
/** How far back to look for new products, unless `?days=` says otherwise. */
export const DEFAULT_MAX_AGE_DAYS = 7;

export type MonitorResult = {
  dryRun: boolean;
  /** Releases added (or that would be, on a dry run). */
  added: ({
    publisher: PublisherKey;
    key: string;
    name: string;
    type: ReleaseType;
    releaseDate: string;
    /** "page" when read from the product page, "published" when it fell back to the store's publish date. */
    releaseDateFrom: "page" | "published";
    url: string;
  } & DisplayParts)[];
  /** New products that weren't added, and why. Already-tracked and old products aren't listed. */
  skipped: { publisher: PublisherKey; handle: string; title: string; reason: string }[];
  /**
   * Releases (new or existing) that were missing a cover or price and now have
   * them. On a dry run, the ones that would be checked.
   */
  detailsFilled: { key: string; cover: boolean; price: boolean }[];
  /** Releases still missing a cover or price after this run (product page gone, or over the per-run limit); on a dry run, how many are missing now. */
  detailsMissing: number;
  /**
   * Existing releases that had no saved title, catalogue and edition and now
   * do (worked out the same way as for new ones). On a dry run, what would be saved.
   */
  titlesFilled: ({ key: string } & DisplayParts)[];
  /** Listings that couldn't be read, prefixed with the publisher. The rest still run. */
  errors: string[];
};

/** The last path segment, so a product matches however its URL was saved: ".../products/srg-163?variant=1" -> "srg-163". */
function slugFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop()?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function runReleaseMonitor({
  dryRun = false,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  now = new Date(),
}: { dryRun?: boolean; maxAgeDays?: number; now?: Date } = {}): Promise<MonitorResult> {
  const result: MonitorResult = { dryRun, added: [], skipped: [], detailsFilled: [], detailsMissing: 0, titlesFilled: [], errors: [] };

  // Releases already tracked, matched by key and by URL slug.
  const existing = await db.release.findMany({ select: { key: true, url: true } });
  const known = new Set<string>();
  for (const release of existing) {
    known.add(release.key.toLowerCase());
    const slug = slugFromUrl(release.url);
    if (slug) known.add(slug);
  }
  const isKnown = (key: string) => known.has(key.toLowerCase());

  for (const publisher of PUBLISHERS) {
    if (!publisher.findNewReleases) continue;
    const findings = await publisher.findNewReleases({ isKnown, maxAgeDays, now });
    result.errors.push(...findings.errors.map((error) => `${publisher.name}: ${error}`));
    result.skipped.push(...findings.skipped.map(({ key, ...rest }) => ({ publisher: publisher.key, handle: key, ...rest })));

    for (const release of findings.releases) {
      if (isKnown(release.key)) continue; // found twice in one run
      known.add(release.key.toLowerCase());
      if (!dryRun) {
        // The poller picks it up on its next run and fills in stock and its launch schedule.
        await db.release.create({
          data: {
            key: release.key,
            name: release.name,
            url: release.url,
            type: release.type,
            releaseDate: release.releaseDate,
            title: release.title,
            catalogue: release.catalogue,
            edition: release.edition,
            publisher: publisher.key,
            currency: publisher.currency,
          },
        });
      }
      result.added.push({
        publisher: publisher.key,
        key: release.key,
        name: release.name,
        type: release.type,
        releaseDate: release.releaseDate.toISOString().slice(0, 10),
        releaseDateFrom: release.releaseDateFrom,
        url: release.url,
        title: release.title,
        catalogue: release.catalogue,
        edition: release.edition,
      });
    }
  }

  await fillMissingDetails(result, dryRun);
  await fillMissingTitleParts(result, dryRun);
  return result;
}

/**
 * Saves the card's title, catalogue number and edition for releases added
 * before they were saved, the same way as for new ones.
 * Once saved they're left alone, so a hand correction sticks.
 */
async function fillMissingTitleParts(result: MonitorResult, dryRun: boolean) {
  const missing = await db.release.findMany({
    where: { title: null },
    select: { id: true, key: true, name: true, url: true, publisher: true },
    orderBy: { releaseDate: "desc" },
    take: MAX_DETAILS_PER_RUN,
  });

  for (let i = 0; i < missing.length; i += DETAILS_CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + DETAILS_CONCURRENCY).map(async (release) => {
        let parts: DisplayParts;
        try {
          parts = await getPublisher(release.publisher).getDisplayParts(release);
        } catch (err) {
          // Without the store's data the result could differ from a new release's, so try again next run.
          console.error(`Failed to work out title parts for release ${release.key}:`, err);
          return;
        }
        if (!dryRun) {
          await db.release.update({
            where: { id: release.id },
            data: { title: parts.title, catalogue: parts.catalogue, edition: parts.edition },
          });
        }
        result.titlesFilled.push({ key: release.key, ...parts });
      }),
    );
  }
}

/**
 * Fills in the cover and price of any release still missing them, including
 * ones just added. The poller does this on each stock check, but a release
 * that isn't on sale yet isn't checked again until launch, so this catches it.
 */
async function fillMissingDetails(result: MonitorResult, dryRun: boolean) {
  const missing = await db.release.findMany({
    where: { OR: [{ coverUrl: null }, { pricePence: null }] },
    select: { id: true, key: true, url: true, name: true, publisher: true, coverUrl: true, pricePence: true },
    orderBy: { releaseDate: "desc" }, // newest first, the ones people look at
  });
  const batch = missing.slice(0, MAX_DETAILS_PER_RUN);

  if (dryRun) {
    result.detailsFilled = batch.map((release) => ({ key: release.key, cover: !release.coverUrl, price: release.pricePence === null }));
    result.detailsMissing = missing.length;
    return;
  }

  let stillMissing = missing.length - batch.length;
  for (let i = 0; i < batch.length; i += DETAILS_CONCURRENCY) {
    await Promise.all(
      batch.slice(i, i + DETAILS_CONCURRENCY).map(async (release) => {
        try {
          // The page is only needed for the cover; the price has its own request.
          const page = release.coverUrl ? { coverUrl: null } : await getPublisher(release.publisher).readProduct(release);
          const saved = await saveProductDetails(release, page);
          const cover = saved.coverUrl !== undefined;
          const price = saved.pricePence !== undefined;
          if (cover || price) result.detailsFilled.push({ key: release.key, cover, price });
          if ((!release.coverUrl && !cover) || (release.pricePence === null && !price)) stillMissing++;
        } catch (err) {
          console.error(`Failed to fill in details for release ${release.key}:`, err);
          stillMissing++;
        }
      }),
    );
  }
  result.detailsMissing = stillMissing;
}
