import type { ReleaseType } from "../../../../zenstack/models";

// Lost in Cult states each EDITION's print run in the product description:
//   "Limited to 1,000 copies (PS5), 1,500 copies (Switch 2)"
//   "Limited to 1,500 copies (Switch 2) and 1,000 copies (PS5)"
//   "Limited to 1,000 copies on PlayStation 5"
//   "Limited to 1,500 copies"
// This reads those numbers per platform.

const LIMITED_TO = /limited to\s+([^.]{0,200})/gi;
// "1,000 copies (PS5)" or "1,000 copies on PlayStation 5" or just "1,500 copies".
const COPIES = /(\d{1,3}(?:,\d{3})+|\d+)\s+copies(?:\s*\(([^)]+)\)|\s+on\s+([a-z0-9 ]+?)(?=\s*(?:,|\band\b|\bit\b|$)))?/gi;

const PLATFORM_LABELS: { pattern: RegExp; type: ReleaseType }[] = [
  { pattern: /^(nintendo\s+)?(switch\s*2|sw2)$/i, type: "SWITCH2" },
  { pattern: /^(nintendo\s+)?(switch|sw1?)$/i, type: "SWITCH" },
  { pattern: /^(play\s*station\s*5|ps5)$/i, type: "PS5" },
  { pattern: /^(play\s*station\s*4|ps4)$/i, type: "PS4" },
  { pattern: /^xbox.*$/i, type: "XBOX" },
];

const SWITCH_FAMILY: ReleaseType[] = ["SWITCH", "SWITCH2"];

function platformOf(label: string): ReleaseType | null {
  const clean = label.trim();
  return PLATFORM_LABELS.find(({ pattern }) => pattern.test(clean))?.type ?? null;
}

export type PrintRuns = {
  /** Print run per platform, where the text names one. */
  byPlatform: Partial<Record<ReleaseType, number>>;
  /** A number given without a platform ("Limited to 1,500 copies"). */
  unlabelled: number | null;
};

/** Every print run the text states. The first mention of a platform wins. */
export function parsePrintRuns(text: string): PrintRuns {
  const result: PrintRuns = { byPlatform: {}, unlabelled: null };
  const plain = text.replace(/\s+/g, " ");
  for (const sentence of plain.matchAll(LIMITED_TO)) {
    for (const match of sentence[1].matchAll(COPIES)) {
      const copies = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(copies) || copies <= 0 || copies > 100_000) continue;
      const label = match[2] ?? match[3];
      if (!label) {
        result.unlabelled ??= copies;
        continue;
      }
      const type = platformOf(label);
      if (type && result.byPlatform[type] === undefined) result.byPlatform[type] = copies;
    }
  }
  return result;
}

/**
 * The print run for one platform's EDITION. `editionPlatforms` are all the
 * platforms the product has an EDITION for, to settle loose wording:
 * - an exact platform match wins;
 * - a number with no platform counts when the product has only one EDITION;
 * - the store sometimes writes "Switch 2" for a Switch EDITION (or the other
 *   way round), so a lone Switch-family number counts for a lone Switch-family EDITION.
 * Returns null when it can't be told, so the card shows copies left instead of a wrong %.
 */
export function printRunFor(runs: PrintRuns, platform: ReleaseType, editionPlatforms: ReleaseType[]): number | null {
  const exact = runs.byPlatform[platform];
  if (exact !== undefined) return exact;

  const labelled = Object.keys(runs.byPlatform) as ReleaseType[];
  if (runs.unlabelled !== null && labelled.length === 0 && editionPlatforms.length === 1) return runs.unlabelled;

  if (SWITCH_FAMILY.includes(platform)) {
    const switchRuns = labelled.filter((type) => SWITCH_FAMILY.includes(type));
    const switchEditions = editionPlatforms.filter((type) => SWITCH_FAMILY.includes(type));
    if (switchRuns.length === 1 && switchEditions.length === 1) return runs.byPlatform[switchRuns[0]] ?? null;
  }
  return null;
}

/** Copies left as a % of the print run. Anything left shows as at least 1%, so it never reads as sold out. */
export function percentageLeft(copiesLeft: number, printRun: number): number {
  if (copiesLeft <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round((copiesLeft / printRun) * 100)));
}
