import { DateTime } from "luxon";
import type { ReleaseType } from "../../../zenstack/models";
import { db } from "@/lib/db";
import { saveProductDetails } from "@/lib/product-details";
import { parseReleaseTitle } from "@/lib/release-title";
import { scrapeProductPage } from "@/lib/scraper";
import { MONITOR_CONFIG, type MonitorConfig } from "@/lib/monitor/config";

// Adds new Super Rare Games releases from the store's collections. Run once a
// day just after the 4pm announcement, from /api/monitor.

const REQUEST_TIMEOUT_MS = 15_000;
// Releases missing a cover or price filled in per run, a few at a time, so a
// big backlog can't push the request past the function's time limit. The rest
// are picked up on the next run.
const MAX_DETAILS_PER_RUN = 60;
const DETAILS_CONCURRENCY = 4;
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SuperRareTracker/1.0; +https://superraretracker.app)",
};

/** The fields used from Shopify's `/collections/<handle>/products.json`. */
type StoreProduct = {
  handle: string;
  title: string;
  product_type: string;
  tags: string[];
  published_at: string;
};

export type DisplayParts = { title: string; catalogue: string | null; edition: string | null };

export type MonitorResult = {
  dryRun: boolean;
  /** Releases added (or that would be, on a dry run). */
  added: ({
    key: string;
    name: string;
    type: ReleaseType;
    releaseDate: string;
    /** "page" when read from the product page, "published" when it fell back to the store's publish date. */
    releaseDateFrom: "page" | "published";
    url: string;
  } & DisplayParts)[];
  /** New products that weren't added, and why. Already-tracked and old products aren't listed. */
  skipped: { handle: string; title: string; reason: string }[];
  /**
   * Releases (new or existing) that were missing a cover or price and now have
   * them. On a dry run, the ones that would be checked.
   */
  detailsFilled: { key: string; cover: boolean; price: boolean }[];
  /** Releases still missing a cover or price after this run (product page gone, or over the per-run limit); on a dry run, how many are missing now. */
  detailsMissing: number;
  /** Collections that couldn't be read. The others still run. */
  errors: string[];
};

async function fetchCollection(config: MonitorConfig, collection: string): Promise<StoreProduct[]> {
  const url = `${config.storeUrl}/collections/${collection}/products.json?limit=250`;
  const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${collection}: request failed with status ${response.status}`);
  const data = (await response.json()) as { products?: StoreProduct[] };
  if (!Array.isArray(data.products)) throw new Error(`${collection}: no products in the response`);
  return data.products;
}

/** The platform, from the rules in config: title marker, product type, tag, then catalogue number. */
export function detectPlatform(product: Pick<StoreProduct, "title" | "product_type" | "tags">, config: MonitorConfig = MONITOR_CONFIG): ReleaseType | null {
  const { platform } = config;
  for (const { pattern, type } of platform.titleMarkers) if (pattern.test(product.title)) return type;
  const byProductType = platform.productTypes[product.product_type];
  if (byProductType) return byProductType;
  for (const tag of product.tags) if (platform.tags[tag]) return platform.tags[tag];
  for (const { pattern, type } of platform.cataloguePrefixes) if (pattern.test(product.title)) return type;
  return null;
}

/** The store title without its platform marker: "SRG#163: Wax Heads (Switch)" -> "SRG#163: Wax Heads". */
export function cleanName(storeTitle: string, config: MonitorConfig = MONITOR_CONFIG): string {
  let name = storeTitle;
  for (const pattern of config.removeFromName) name = name.replace(pattern, "");
  return name.replace(/\s{2,}/g, " ").trim();
}

/**
 * The title, catalogue number and edition the card shows, worked out once and
 * saved, so a wrong one can be corrected by hand and stays corrected.
 *
 * The title parser handles the usual "[Edition] SRG#163: Title" names. When it
 * finds neither a catalogue number nor an edition, a tag that starts the name
 * is taken as the game's title and the rest as the edition:
 * "Wax Heads: Switch Game & Vinyl (Bundle)" with tag "Wax Heads" gives
 * title "Wax Heads" and edition "Game & Vinyl Bundle".
 */
export function getDisplayParts(name: string, tags: string[], config: MonitorConfig = MONITOR_CONFIG): DisplayParts {
  const parsed = parseReleaseTitle(name);
  if (parsed.catalogue || parsed.edition) {
    return { title: parsed.title, catalogue: parsed.catalogue, edition: parsed.edition };
  }

  const titleTag = tags
    .filter((tag) => !config.nonTitleTags.some((pattern) => pattern.test(tag)))
    .sort((a, b) => b.length - a.length) // the longest match, so "Wax Heads" beats "Wax"
    .find((tag) => name.toLowerCase().startsWith(`${tag.toLowerCase()}:`));
  if (!titleTag) return { title: parsed.title, catalogue: null, edition: null };

  const edition = name
    .slice(titleTag.length + 1)
    .replace(config.editionPlatformWords, "")
    .replace(/\((Bundle)\)/i, "$1") // "(Bundle)" -> "Bundle"
    .replace(/\s{2,}/g, " ")
    .trim();
  // Keep the store's casing ("KILL KNIGHT"), not the tag's.
  return { title: name.slice(0, titleTag.length), catalogue: null, edition: edition || null };
}

/** "12th November, 2026" -> 2026-11-12T00:00:00Z, or null if it can't be read. */
export function parseReleaseDate(text: string, config: MonitorConfig = MONITOR_CONFIG): Date | null {
  const cleaned = text.replace(/(\d+)(?:st|nd|rd|th)\b/i, "$1").replace(/\s+/g, " ").trim();
  for (const format of config.releaseDateFormats) {
    const date = DateTime.fromFormat(cleaned, format, { zone: "utc", locale: "en-GB" });
    if (date.isValid) return date.toJSDate();
  }
  return null;
}

async function fetchReleaseDate(url: string, config: MonitorConfig): Promise<Date | null> {
  try {
    const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return null;
    const match = (await response.text()).match(config.releaseDatePattern);
    return match ? parseReleaseDate(match[1], config) : null;
  } catch {
    return null;
  }
}

/** "https://superraregames.com/collections/x/products/srg-163?variant=1" -> "srg-163" */
function handleFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.match(/\/products\/([^/]+)/)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function runReleaseMonitor({
  dryRun = false,
  maxAgeDays = MONITOR_CONFIG.maxAgeDays,
  config = MONITOR_CONFIG,
  now = new Date(),
}: { dryRun?: boolean; maxAgeDays?: number; config?: MonitorConfig; now?: Date } = {}): Promise<MonitorResult> {
  const result: MonitorResult = { dryRun, added: [], skipped: [], detailsFilled: [], detailsMissing: 0, errors: [] };

  // Every collection, de-duplicated by handle.
  const products = new Map<string, StoreProduct>();
  for (const collection of config.collections) {
    try {
      for (const product of await fetchCollection(config, collection)) products.set(product.handle.toLowerCase(), product);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // Releases already tracked, matched by handle so URL variations don't matter.
  const existing = await db.release.findMany({ select: { key: true, url: true } });
  const known = new Set<string>();
  for (const release of existing) {
    known.add(release.key.toLowerCase());
    const handle = handleFromUrl(release.url);
    if (handle) known.add(handle);
  }

  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  for (const [handle, product] of products) {
    if (known.has(handle) || config.ignoredHandles.includes(handle)) continue;
    if (new Date(product.published_at).getTime() < cutoff) continue;

    const skip = (reason: string) => result.skipped.push({ handle, title: product.title, reason });
    if (!(config.includeProductTypes as readonly string[]).includes(product.product_type)) {
      skip(`product type "${product.product_type}" isn't a release`);
      continue;
    }
    if (config.excludeTitles.some((pattern) => pattern.test(product.title))) {
      skip("title matches an excluded pattern");
      continue;
    }
    const type = detectPlatform(product, config);
    if (!type) {
      skip("couldn't tell the platform");
      continue;
    }

    const url = `${config.storeUrl}/products/${product.handle}`;
    const name = cleanName(product.title, config);
    const pageDate = await fetchReleaseDate(url, config);
    const releaseDate = pageDate ?? DateTime.fromISO(product.published_at).toUTC().startOf("day").toJSDate();
    const parts = getDisplayParts(name, product.tags, config);

    if (!dryRun) {
      // The poller picks it up on its next run and fills in cover, price and stock.
      await db.release.create({
        data: { key: handle, name, url, type, releaseDate, title: parts.title, catalogue: parts.catalogue, edition: parts.edition },
      });
    }
    result.added.push({
      key: handle,
      name,
      type,
      releaseDate: releaseDate.toISOString().slice(0, 10),
      releaseDateFrom: pageDate ? "page" : "published",
      url,
      ...parts,
    });
  }

  await fillMissingDetails(result, dryRun);
  return result;
}

/**
 * Fills in the cover and price of any release still missing them, including
 * ones just added. The poller does this on each stock check, but a release
 * that isn't on sale yet isn't checked again until launch, so this catches it.
 */
async function fillMissingDetails(result: MonitorResult, dryRun: boolean) {
  const missing = await db.release.findMany({
    where: { OR: [{ coverUrl: null }, { pricePence: null }] },
    select: { id: true, key: true, url: true, coverUrl: true, pricePence: true },
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
          const page = release.coverUrl ? { coverUrl: null } : await scrapeProductPage(release.url);
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
