import type { ReleaseType } from "../../../../zenstack/models";

// Everything the app assumes about Lost in Cult's store. Edit these when the
// store changes, then check with /api/monitor?dryRun=1.

export const LOST_IN_CULT_CONFIG = {
  storeUrl: "https://www.lostincult.co.uk",
  /** Squarespace's JSON version of the shop, 200 products a page. */
  shopPath: "/shop",

  /**
   * Only the limited EDITION options of a game become releases, one per
   * platform: "Playstation 5 EDITION", "Nintendo Switch 2 EDITION". Retail and
   * Retail+ options aren't limited, so they're skipped. Longest names first, so
   * "Nintendo Switch 2" isn't read as "Nintendo Switch".
   */
  editionOption: /^(.+?)\s+EDITION$/i,
  platforms: [
    { pattern: /^(nintendo\s+)?switch\s*2$/i, type: "SWITCH2", label: "Switch 2", slug: "sw2" },
    { pattern: /^(nintendo\s+)?switch$/i, type: "SWITCH", label: "Switch", slug: "sw" },
    { pattern: /^play\s*station\s*5$|^ps5$/i, type: "PS5", label: "PS5", slug: "ps5" },
    { pattern: /^play\s*station\s*4$|^ps4$/i, type: "PS4", label: "PS4", slug: "ps4" },
    { pattern: /^xbox( series x\|s)?$/i, type: "XBOX", label: "Xbox", slug: "xbox" },
  ] satisfies { pattern: RegExp; type: ReleaseType; label: string; slug: string }[],

  /**
   * Products skipped even with an EDITION option. Game + vinyl bundles have
   * their own small allocation, but the description quotes the game's print
   * run, so a percentage would be wrong.
   */
  skipTitles: [/\bbundle\b/i],
} as const;

export type LostInCultConfig = typeof LOST_IN_CULT_CONFIG;
