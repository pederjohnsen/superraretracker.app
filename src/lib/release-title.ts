// Splits a Super Rare Games store title into the parts the release cards show,
// e.g. "[Special Edition] SE#03: Haste" -> edition "Special Edition",
// catalogue "SE#03", title "Haste". The platform comes from the release's
// `type`, not the title (see src/lib/platform.ts).

export type ParsedReleaseTitle = {
  title: string;
  catalogue: string | null;
  edition: string | null;
  reprint: boolean;
  patchRequired: boolean;
  /** Opened stock sold as new-condition ("UNSEALED [Deluxe Edition] DE#4: …"). */
  unsealed: boolean;
};

const UNSEALED = /^UNSEALED\s+/i;
const EDITION = /^\[([^\]]+)\]\s*/; // [Special Edition]
const CATALOGUE = /^([A-Za-z0-9]+(?: [A-Za-z]+)?\s?#\d+)\s*[:\-–]\s*/; // SRG#163: / PS5 Bundle #8: / PS5#31 -
const REPRINT = /\s*\[REPRINT\]\s*$/i;
const PATCH_REQUIRED = /\s*\(PATCH REQUIRED\)\s*$/i;

// "Sw2#02" -> "SW2#02", "PS5 #22" -> "PS5#22", keeps "PS5 Bundle #8".
function tidyCatalogue(raw: string): string {
  return raw
    .replace(/[A-Za-z0-9]+/g, (word) => (/\d/.test(word) || word.length <= 3 ? word.toUpperCase() : word))
    .replace(/^(\S+) #/, "$1#");
}

export function parseReleaseTitle(storeTitle: string): ParsedReleaseTitle {
  let rest = storeTitle.trim();

  const unsealed = UNSEALED.test(rest);
  rest = rest.replace(UNSEALED, "");

  let edition = rest.match(EDITION)?.[1] ?? null;
  rest = rest.replace(EDITION, "");

  const rawCatalogue = rest.match(CATALOGUE)?.[1];
  const catalogue = rawCatalogue ? tidyCatalogue(rawCatalogue) : null;
  rest = rest.replace(CATALOGUE, "");

  const reprint = REPRINT.test(rest);
  rest = rest.replace(REPRINT, "");
  const patchRequired = PATCH_REQUIRED.test(rest);
  rest = rest.replace(PATCH_REQUIRED, "");

  if (!edition && catalogue && /(?:^|\s)(?:PB|Bundle)\s?#/i.test(catalogue)) edition = "Bundle";

  return { title: rest.trim() || storeTitle.trim(), catalogue, edition, reprint, patchRequired, unsealed };
}
