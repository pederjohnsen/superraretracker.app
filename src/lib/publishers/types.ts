import type { ReleaseType } from "../../../zenstack/models";

// What the app needs from each publisher's store. Each publisher is a module
// under src/lib/publishers/<key>/, so its URLs, page rules and quirks live in
// one place and can be changed without touching the poller or monitor.

/** Keys stored in `Release.publisher`. Adding a publisher adds its key here. */
export type PublisherKey = "super-rare-games";

/** ISO 4217 currency of the store's prices. */
export type Currency = "GBP" | "EUR";

/** The release fields a publisher needs to find its product. */
export type ReleaseRef = { key: string; url: string; name: string };

/** One read of a product page. */
export type ProductSnapshot = {
  /** Stock left, 0–100, or null when the page shows no level (not on sale yet, or the store doesn't show one). */
  stockPercentage: number | null;
  /** The product image, sized for the cards, or null if the page has none. */
  coverUrl: string | null;
};

/** What the card shows, split out from the store title. */
export type DisplayParts = { title: string; catalogue: string | null; edition: string | null };

/** A product the monitor found that isn't tracked yet. */
export type NewRelease = {
  key: string;
  name: string;
  url: string;
  type: ReleaseType;
  releaseDate: Date;
  /** "page" when read from the product page, "published" when it fell back to the store's publish date. */
  releaseDateFrom: "page" | "published";
} & DisplayParts;

export type MonitorFindings = {
  releases: NewRelease[];
  /** New products that weren't added, and why. */
  skipped: { key: string; title: string; reason: string }[];
  /** Listings that couldn't be read. The others still count. */
  errors: string[];
};

export type Publisher = {
  key: PublisherKey;
  name: string;
  /** The store, without a trailing slash. */
  storeUrl: string;
  currency: Currency;

  /**
   * When stock goes on sale on a release's date, in the store's time zone, and
   * how many minutes earlier the poller starts checking.
   */
  launch: { timeZone: string; hour: number; minute: number; pollLeadMinutes: number };

  /** Reads stock and cover. Throws when the page can't be fetched, so the poller can back off. */
  readProduct(release: ReleaseRef): Promise<ProductSnapshot>;
  /** The price in minor units of `currency` (3720 for £37.20), or null if not found. */
  fetchPrice(release: ReleaseRef): Promise<number | null>;
  /** Splits a release's name into title, catalogue number and edition, using whatever else the store offers. */
  getDisplayParts(release: ReleaseRef): Promise<DisplayParts>;

  /** Finds products that aren't tracked yet. `isKnown` matches by key or URL. */
  findNewReleases?(options: { isKnown: (key: string) => boolean; maxAgeDays: number; now: Date }): Promise<MonitorFindings>;
};
