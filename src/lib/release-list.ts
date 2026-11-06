import type { ReleaseType } from "../../zenstack/models";
import { isReleaseType } from "@/lib/platform";

// Filtering and sorting for the release list. Kept out of the page so the
// rules are in one place when more filters (say, publisher) are added.

export type PlatformFilter = "ALL" | ReleaseType;

export const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "stock-asc", label: "Lowest stock" },
  { value: "stock-desc", label: "Most stock" },
  { value: "title", label: "Title A–Z" },
  { value: "price-asc", label: "Price: low–high" },
] as const;

export type SortOrder = (typeof SORT_OPTIONS)[number]["value"];

export function isPlatformFilter(value: string): value is PlatformFilter {
  return value === "ALL" || isReleaseType(value);
}

export function isSortOrder(value: string): value is SortOrder {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export type ListableRelease = {
  name: string;
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
  platform: PlatformFilter;
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
    if (filters.platform !== "ALL" && release.type !== filters.platform) return false;
    if (filters.trackedOnly && !filters.isTracked(release)) return false;
    if (!query) return true;
    // The store name covers title, catalogue and edition in one string.
    return normalise(release.name).includes(query) || normalise(release.title).includes(query);
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
