import { LOST_IN_CULT_CONFIG as CONFIG } from "./config";

// Reading Lost in Cult's Squarespace store. Adding `?format=json-pretty` to a
// shop or product URL returns its data as JSON, including each option's exact
// stock (`qtyInStock`), so stock is never probed by adding to the basket.

const REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SuperRareTracker/1.0; +https://superraretracker.app)",
};
// Cards show covers 96px wide; Squarespace resizes with ?format=.
const COVER_FORMAT = "300w";
/** Pages of 200 products; the shop has a few hundred. */
const MAX_SHOP_PAGES = 5;

export type StoreVariant = {
  id: string;
  /** { Type: "Playstation 5 EDITION" } */
  attributes?: Record<string, string>;
  /** Copies left, when `unlimited` is false. */
  qtyInStock: number;
  /** The store isn't counting this option's stock. */
  unlimited: boolean;
  priceMoney?: { currency: string; value: string };
  mainImage?: { assetUrl?: string } | null;
};

export type StoreProduct = {
  id: string;
  title: string;
  /** "/shop/p/my-friendly-neighborhood" */
  fullUrl: string;
  /** "my-friendly-neighborhood" */
  urlId: string;
  /** When the product was published on the store, in ms. */
  publishOn: number;
  assetUrl?: string;
  variants?: StoreVariant[];
};

async function get(url: string): Promise<Response> {
  const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Request to ${url} failed with status ${response.status}`);
  return response;
}

function jsonUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("format", "json-pretty");
  return parsed.toString();
}

/** Every product in the shop, newest first. */
export async function fetchShopProducts(): Promise<StoreProduct[]> {
  const products: StoreProduct[] = [];
  let offset: number | null = 0;
  for (let page = 0; page < MAX_SHOP_PAGES && offset !== null; page++) {
    const url = new URL(CONFIG.shopPath, CONFIG.storeUrl);
    if (offset > 0) url.searchParams.set("offset", String(offset));
    const data = (await (await get(jsonUrl(url.toString()))).json()) as {
      items?: StoreProduct[];
      pagination?: { nextPage?: boolean; nextPageOffset?: number };
    };
    if (!Array.isArray(data.items)) throw new Error("No products in the shop listing");
    products.push(...data.items);
    offset = data.pagination?.nextPage && data.pagination.nextPageOffset ? data.pagination.nextPageOffset : null;
  }
  return products;
}

/** One product with its options and their stock. */
export async function fetchProduct(productUrl: string): Promise<StoreProduct> {
  const data = (await (await get(jsonUrl(productUrl))).json()) as { item?: StoreProduct };
  if (!data.item) throw new Error(`No product data at ${productUrl}`);
  return data.item;
}

/** The product page as plain text, for the print runs in its description (not in the JSON). */
export async function fetchProductText(productUrl: string): Promise<string> {
  const html = await (await get(productUrl)).text();
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ");
}

/** The option's image, or the product's, sized for the cards. */
export function coverUrl(product: StoreProduct, variant: StoreVariant | undefined): string | null {
  const image = variant?.mainImage?.assetUrl || product.assetUrl;
  if (!image) return null;
  try {
    const url = new URL(image);
    url.searchParams.set("format", COVER_FORMAT);
    return url.toString();
  } catch {
    return null;
  }
}

/** "59.99" GBP -> 5999. Null for another currency or a missing price. */
export function pricePence(variant: StoreVariant | undefined): number | null {
  const money = variant?.priceMoney;
  if (!money || money.currency !== "GBP") return null;
  const value = Number(money.value);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}
