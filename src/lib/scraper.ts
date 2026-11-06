import * as cheerio from "cheerio";

const STOCK_BAR_SELECTOR = ".stock-bar";
const REQUEST_TIMEOUT_MS = 10_000;
// Shopify resizes on its image server. Cards show covers 96px wide, so 240 stays sharp at 2x.
const COVER_WIDTH = 240;

export type ProductPage = {
  /** The stock bar's width, or null when there's no bar (not on sale yet, or sold out without one). */
  stockPercentage: number | null;
  /** The product image, resized by Shopify's image server. */
  coverUrl: string | null;
};

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SuperRareTracker/1.0; +https://superraretracker.app)",
};

// Scrapes a Super Rare Games product page for its stock bar and cover image.
export async function scrapeProductPage(url: string): Promise<ProductPage> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  const $ = cheerio.load(await response.text());
  return {
    stockPercentage: readStockPercentage($),
    coverUrl: readCoverUrl($),
  };
}

function readStockPercentage($: cheerio.CheerioAPI): number | null {
  const stockBar = $(STOCK_BAR_SELECTOR).first();
  if (stockBar.length === 0) return null;

  const width = stockBar.css("width") ?? "";
  if (!width.trim()) return null;

  const stockPercentage = Number(width.replace("%", "").trim());
  return Number.isNaN(stockPercentage) ? null : stockPercentage;
}

function readCoverUrl($: cheerio.CheerioAPI): string | null {
  // Shopify gives og:image as http:; switch to https and ask for a small size.
  const image = $('meta[property="og:image:secure_url"]').attr("content") ?? $('meta[property="og:image"]').attr("content");
  if (!image) return null;
  try {
    const url = new URL(image.replace(/^http:/, "https:"), "https://superraregames.com");
    url.searchParams.set("width", String(COVER_WIDTH));
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * The product's UK price in pence, VAT included (e.g. 3720 for a £37.20 game),
 * from Shopify's product JSON (the product URL plus ".js").
 *
 * Shopify picks a market per request: the server looks like it's in the US,
 * and any Accept-Language header (which fetch always sends) gets the price
 * without VAT. `country=GB` pins the UK market so the price matches what
 * UK customers see.
 */
export async function fetchProductPricePence(url: string): Promise<number | null> {
  const productUrl = new URL(url);
  productUrl.search = "?country=GB";
  productUrl.pathname = `${productUrl.pathname.replace(/\/$/, "")}.js`;

  const response = await fetch(productUrl, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Request to ${productUrl} failed with status ${response.status}`);
  }

  const product = (await response.json()) as { price?: unknown };
  return typeof product.price === "number" && Number.isInteger(product.price) && product.price > 0
    ? product.price
    : null;
}
