import type { ReleaseType } from "../../../../zenstack/models";
import { LOST_IN_CULT_CONFIG as CONFIG, type LostInCultConfig } from "./config";
import type { StoreProduct, StoreVariant } from "./store";

export type Edition = { variant: StoreVariant; type: ReleaseType; label: string; slug: string };

/** A product's EDITION options, one per platform: "Playstation 5 EDITION" -> PS5. */
export function findEditions(product: Pick<StoreProduct, "variants">, config: LostInCultConfig = CONFIG): Edition[] {
  const editions: Edition[] = [];
  for (const variant of product.variants ?? []) {
    for (const value of Object.values(variant.attributes ?? {})) {
      const match = value.trim().match(config.editionOption);
      if (!match) continue;
      const platform = config.platforms.find(({ pattern }) => pattern.test(match[1].trim()));
      if (platform && !editions.some((edition) => edition.type === platform.type)) {
        editions.push({ variant, type: platform.type, label: platform.label, slug: platform.slug });
      }
    }
  }
  return editions;
}

/** "lic-my-friendly-neighborhood-ps5" */
export function releaseKey(product: Pick<StoreProduct, "urlId">, edition: Pick<Edition, "slug">): string {
  return `lic-${product.urlId}-${edition.slug}`.toLowerCase();
}

/** "My Friendly Neighborhood – PS5 EDITION": the store title plus which EDITION. */
export function releaseName(product: Pick<StoreProduct, "title">, edition: Pick<Edition, "label">): string {
  return `${product.title.trim()} – ${edition.label} EDITION`;
}
