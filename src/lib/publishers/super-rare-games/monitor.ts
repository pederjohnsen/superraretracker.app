import { DateTime } from "luxon";
import type { ReleaseType } from "../../../../zenstack/models";
import { parseReleaseTitle } from "@/lib/release-title";
import type { DisplayParts, MonitorFindings, NewRelease } from "@/lib/publishers/types";
import { MONITOR_CONFIG, type MonitorConfig } from "./monitor-config";

// How the monitor finds new Super Rare Games releases: the store's Shopify
// collection feeds, filtered and split by the rules in monitor-config.ts.

const REQUEST_TIMEOUT_MS = 15_000;
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

/** Products in the configured collections that aren't tracked yet and pass the rules. */
export async function findNewReleases(
  { isKnown, maxAgeDays, now }: { isKnown: (key: string) => boolean; maxAgeDays: number; now: Date },
  config: MonitorConfig = MONITOR_CONFIG,
): Promise<MonitorFindings> {
  const findings: MonitorFindings = { releases: [], skipped: [], errors: [] };

  // Every collection, de-duplicated by handle.
  const products = new Map<string, StoreProduct>();
  for (const collection of config.collections) {
    try {
      for (const product of await fetchCollection(config, collection)) products.set(product.handle.toLowerCase(), product);
    } catch (err) {
      findings.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  for (const [handle, product] of products) {
    if (isKnown(handle) || config.ignoredHandles.includes(handle)) continue;
    if (new Date(product.published_at).getTime() < cutoff) continue;

    const skip = (reason: string) => findings.skipped.push({ key: handle, title: product.title, reason });
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
    const release: NewRelease = {
      key: handle,
      name,
      url,
      type,
      releaseDate: pageDate ?? DateTime.fromISO(product.published_at).toUTC().startOf("day").toJSDate(),
      releaseDateFrom: pageDate ? "page" : "published",
      ...getDisplayParts(name, product.tags, config),
    };
    findings.releases.push(release);
  }

  return findings;
}
