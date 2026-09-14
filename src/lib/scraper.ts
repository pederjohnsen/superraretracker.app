import * as cheerio from "cheerio";
import isNaN from "lodash/isNaN";

const STOCK_BAR_SELECTOR = ".stock-bar";
const REQUEST_TIMEOUT_MS = 10_000;

// Scrapes a Super Rare Games product page and returns the stock bar's width percentage.
export async function scrapeStockPercentage(url: string): Promise<number | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SuperRareTracker/1.0; +https://superraretracker.app)",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const stockBar = $(STOCK_BAR_SELECTOR).first();

  if (stockBar.length === 0) {
    return null;
  }

  const width = stockBar.css("width") ?? "";
  if (!width.trim()) {
    return null;
  }
  const stockPercentage = Number(width.replace("%", "").trim());

  if (isNaN(stockPercentage)) {
    return null;
  }

  return stockPercentage;
}
