import type { Publisher, PublisherKey } from "@/lib/publishers/types";
import { superRareGames } from "@/lib/publishers/super-rare-games";

export type { Publisher, PublisherKey } from "@/lib/publishers/types";

/** Every publisher the app tracks, in the order the monitor runs them. */
export const PUBLISHERS: Publisher[] = [superRareGames];

const BY_KEY = new Map<string, Publisher>(PUBLISHERS.map((publisher) => [publisher.key, publisher]));

/** The publisher for a release's `publisher` column. Throws for an unknown key, so a typo can't fail silently. */
export function getPublisher(key: string): Publisher {
  const publisher = BY_KEY.get(key);
  if (!publisher) throw new Error(`Unknown publisher "${key}"`);
  return publisher;
}

export function isPublisherKey(key: string): key is PublisherKey {
  return BY_KEY.has(key);
}
