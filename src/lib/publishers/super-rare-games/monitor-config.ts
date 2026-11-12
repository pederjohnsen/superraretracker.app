import type { ReleaseType } from "../../../../zenstack/models";

// Everything the release monitor relies on about the Super Rare Games store,
// in one place. If the store changes its URLs, product types or page wording,
// this is the file to edit. Rules are tried in order; the first match wins.

export const MONITOR_CONFIG = {
  /** The store, without a trailing slash. Product URLs are built as `${storeUrl}/products/${handle}`. */
  storeUrl: "https://superraregames.com",

  /**
   * Collections to read. Each is fetched as Shopify's JSON feed
   * (`/collections/<handle>/products.json`), which doesn't change when the
   * store's design does. A product in several collections is only added once.
   */
  collections: ["srg-store-new-web", "switch", "switch-2", "playstation"],


  /** Shopify product types that are trackable releases. Anything else (Merch, Trading Cards, Steelbook…) is skipped. */
  includeProductTypes: ["Switch", "Switch 2", "PlayStation", "Collector's Edition"],

  /** Titles to skip even when the product type matches. */
  excludeTitles: [/trading card/i, /booster pack/i],

  /** Product handles never to add, such as a release you deleted on purpose. */
  ignoredHandles: [] as string[],

  /**
   * How to tell the platform, tried in order:
   * 1. a marker in the title, 2. the product type, 3. a tag, 4. the catalogue number.
   */
  platform: {
    titleMarkers: [
      { pattern: /\(Switch 2\)|Nintendo Switch 2 Edition/i, type: "SWITCH2" },
      { pattern: /\(Switch\)/i, type: "SWITCH" },
      { pattern: /\(PS5\)/i, type: "PS5" },
      { pattern: /\(PS4\)/i, type: "PS4" },
      { pattern: /\(Xbox[^)]*\)/i, type: "XBOX" },
    ] satisfies { pattern: RegExp; type: ReleaseType }[],
    productTypes: { Switch: "SWITCH", "Switch 2": "SWITCH2", PlayStation: "PS5" } as Record<string, ReleaseType>,
    tags: { "Switch 2": "SWITCH2", Switch: "SWITCH", PS5: "PS5", PS4: "PS4" } as Record<string, ReleaseType>,
    cataloguePrefixes: [
      { pattern: /\bSW2\b/i, type: "SWITCH2" },
      { pattern: /\bSRG\s?#/i, type: "SWITCH" },
      { pattern: /\bPS5\b/i, type: "PS5" },
    ] satisfies { pattern: RegExp; type: ReleaseType }[],
  },

  /**
   * Removed from the store title before it's saved as the release's name; the
   * platform is saved as its `type` instead. "SRG#163: Wax Heads (Switch)"
   * becomes "SRG#163: Wax Heads".
   */
  removeFromName: [/\s*\((?:Switch 2|Switch|PS5|PS4|PS|Xbox[^)]*)\)/gi, /\s*-\s*Nintendo Switch 2 Edition\b/gi],

  /** Tags that are never a game's name, so they're not used as the title hint. */
  nonTitleTags: [/^(?:Switch|Switch 2|PS5|PS4|Playstation|pre-order|PB|SRO|sale|lowstock|Steelbook.*|blackfriday|bigsummersale|anikatest)$/i],

  /** Words dropped from an edition taken from the title, since the platform has its own badge. */
  editionPlatformWords: /\b(?:Nintendo\s+)?(?:Switch 2|Switch|PS5|PS4|PlayStation)\b/gi,

  /**
   * Finds the release date on a product page. The first capture group is the
   * date as written, e.g. "12th November, 2026". With no match, the date the
   * store published the product is used and the result says so.
   */
  releaseDatePattern: /Release Date:\s*(?:<[^>]+>\s*)*([^<]+?)\s*</i,
  /** Formats the date text is tried against, after "12th" becomes "12" (luxon tokens). */
  releaseDateFormats: ["d MMMM, yyyy", "d MMMM yyyy", "d MMM, yyyy", "d MMM yyyy", "dd/MM/yyyy"],
} as const;

export type MonitorConfig = typeof MONITOR_CONFIG;
