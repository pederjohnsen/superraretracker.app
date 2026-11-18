import type { ReleaseType } from "../../zenstack/models";
import { isReleaseType } from "@/lib/platform";

// Filtering and sorting for the release list. Kept out of the page so the
// rules are in one place when more filters (say, publisher) are added.


export const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "stock-asc", label: "Lowest stock" },
  { value: "stock-desc", label: "Most stock" },
  { value: "title", label: "Title A–Z" },
  { value: "price-asc", label: "Price: low–high" },
] as const;

export type SortOrder = (typeof SORT_OPTIONS)[number]["value"];

/**
 * The saved platform selection, as stored on the device: "ALL" (or empty) for
 * every platform, otherwise a comma-separated list like "SWITCH2,PS5". A single
 * value, like the old one-platform filter saved, reads as a list of one.
 * Returns null for anything else, so a bad value falls back to the default.
 */
export function parsePlatformSelection(value: string): ReleaseType[] | null {
  if (value === "" || value === "ALL") return [];
  const types = value.split(",");
  return types.every(isReleaseType) ? types : null;
}

export function formatPlatformSelection(platforms: ReleaseType[]): string {
  return platforms.length === 0 ? "ALL" : platforms.join(",");
}

/**
 * Publishers in the order the filter shows them. Ones not listed (added later)
 * follow, by name.
 */
export const PUBLISHER_ORDER = ["super-rare-games", "strictly-limited-games", "lost-in-cult"];

export type PublisherOption = { key: string; name: string };

/** The publishers that have releases, in filter order. */
export function listPublishers(releases: { publisher: string; publisherName: string }[]): PublisherOption[] {
  const names = new Map<string, string>();
  for (const release of releases) names.set(release.publisher, release.publisherName);
  const rank = (key: string) => {
    const index = PUBLISHER_ORDER.indexOf(key);
    return index === -1 ? PUBLISHER_ORDER.length : index;
  };
  return [...names]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.name.localeCompare(b.name));
}

/** Saved publisher picks: "ALL" (or empty) for every publisher, otherwise a comma-separated list of keys. */
export function parsePublisherSelection(value: string): string[] {
  return value === "" || value === "ALL" ? [] : value.split(",").filter(Boolean);
}

export function formatPublisherSelection(publishers: string[]): string {
  return publishers.length === 0 ? "ALL" : publishers.join(",");
}

/** On sale now, with stock left. Sold out, not on sale yet and no stock level on the store don't count. */
export function isInStock(release: Pick<ListableRelease, "stockLiveAt" | "lastStockPercentage">): boolean {
  return !release.stockLiveAt && release.lastStockPercentage !== null && release.lastStockPercentage > 0;
}

export function isSortOrder(value: string): value is SortOrder {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export type ListableRelease = {
  name: string;
  publisher: string;
  publisherName: string;
  title: string;
  catalogue: string | null;
  edition: string | null;
  type: ReleaseType;
  releaseDate: string;
  lastStockPercentage: number | null;
  pricePence: number | null;
  stockLiveAt: string | null;
};

export type ReleaseFilters<T> = {
  search: string;
  /** Platforms to show; empty shows every platform. */
  platforms: ReleaseType[];
  /** Publisher keys to show; empty shows every publisher. */
  publishers?: string[];
  inStockOnly: boolean;
  trackedOnly: boolean;
  isTracked: (release: T) => boolean;
};

// "srg 163", "SRG#163" and "srg163" all match SRG#163.
function normalise(text: string): string {
  return text.toLowerCase().replace(/[\s#:\-–]+/g, "");
}

export function filterReleases<T extends ListableRelease>(releases: T[], filters: ReleaseFilters<T>): T[] {
  const query = normalise(filters.search);
  return releases.filter((release) => {
    if (filters.platforms.length > 0 && !filters.platforms.includes(release.type)) return false;
    if (filters.publishers && filters.publishers.length > 0 && !filters.publishers.includes(release.publisher)) return false;
    if (filters.inStockOnly && !isInStock(release)) return false;
    if (filters.trackedOnly && !filters.isTracked(release)) return false;
    if (!query) return true;
    // The store name covers title, catalogue and edition in one string.
    return (
      normalise(release.name).includes(query) ||
      normalise(release.title).includes(query) ||
      normalise(release.publisherName).includes(query)
    );
  });
}

// Releases with no current stock (not on sale yet, or never read) go last for stock sorts.
function stockForSort(release: ListableRelease): number | null {
  return release.stockLiveAt ? null : release.lastStockPercentage;
}

function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

const byDate = (a: ListableRelease, b: ListableRelease) =>
  new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
const byTitle = (a: ListableRelease, b: ListableRelease) =>
  a.title.localeCompare(b.title, "en-GB", { sensitivity: "base", numeric: true });

export function sortReleases<T extends ListableRelease>(releases: T[], sort: SortOrder): T[] {
  const sorted = [...releases];
  switch (sort) {
    case "date-desc":
      return sorted.sort((a, b) => byDate(b, a) || byTitle(a, b));
    case "date-asc":
      return sorted.sort((a, b) => byDate(a, b) || byTitle(a, b));
    case "stock-asc":
      return sorted.sort((a, b) => compareNullable(stockForSort(a), stockForSort(b), 1) || byDate(b, a));
    case "stock-desc":
      return sorted.sort((a, b) => compareNullable(stockForSort(a), stockForSort(b), -1) || byDate(b, a));
    case "title":
      return sorted.sort(byTitle);
    case "price-asc":
      return sorted.sort((a, b) => compareNullable(a.pricePence, b.pricePence, 1) || byTitle(a, b));
  }
}
