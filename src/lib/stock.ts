// Stock tiers shared by the release cards and the push notifications, so the
// label on a card always matches the alert someone just received.

export type StockTier =
  | "ok"
  | "getting-low"
  | "low"
  | "very-low"
  | "critical"
  | "sold-out"
  | "unknown";

export function getStockTier(percentage: number | null | undefined): StockTier {
  if (percentage == null) return "unknown";
  if (percentage <= 0) return "sold-out";
  if (percentage <= 2) return "critical";
  if (percentage <= 5) return "very-low";
  if (percentage <= 10) return "low";
  if (percentage <= 25) return "getting-low";
  return "ok";
}

export const STOCK_LABEL: Record<StockTier, string> = {
  ok: "In stock",
  "getting-low": "Getting low",
  low: "Low stock",
  "very-low": "Very low",
  critical: "Critically low",
  "sold-out": "Sold out",
  unknown: "Stock unknown",
};

/** Shown before launch instead of any tier, whatever the percentage says. */
export const NOT_ON_SALE_LABEL = "Not on sale yet";

// Highest first, so the list reads the way stock falls.
export const THRESHOLD_OPTIONS = [50, 40, 30, 25, 20, 15, 10, 5, 2] as const;

/**
 * The default alert level when someone starts tracking: the highest option at
 * or below current stock. Unknown stock means every option is valid, so start
 * at the highest.
 */
export function getDefaultThreshold(currentPercentage: number | null): number {
  if (currentPercentage === null) return THRESHOLD_OPTIONS[0];
  return (
    THRESHOLD_OPTIONS.find((option) => option <= currentPercentage) ??
    THRESHOLD_OPTIONS[THRESHOLD_OPTIONS.length - 1]
  );
}

export function buildStockAlertMessage(
  releaseName: string,
  currentPercentage: number,
): { title: string; body: string } {
  const title = `Stock alert: ${currentPercentage}%`;
  switch (getStockTier(currentPercentage)) {
    // Selling out shares the critical message; coming back gets buildRestockAlertMessage.
    case "sold-out":
    case "critical":
      return {
        title,
        body: `${releaseName}: critically low stock at ${currentPercentage}% — act before it's too late!`,
      };
    case "very-low":
      return {
        title,
        body: `${releaseName}: only ${currentPercentage}% left in stock — grab it before it sells out.`,
      };
    case "low":
      return {
        title,
        body: `${releaseName}: stock is getting low at ${currentPercentage}% — don't wait too long.`,
      };
    case "getting-low":
      return {
        title,
        body: `${releaseName}: stock is down to ${currentPercentage}%, but there is still time to decide.`,
      };
    default:
      return {
        title,
        body: `${releaseName}: stock has dropped to ${currentPercentage}%, matching the alert you set.`,
      };
  }
}

/** Sent to everyone tracking a release when it goes from sold out back into stock. */
export function buildRestockAlertMessage(
  releaseName: string,
  currentPercentage: number,
): { title: string; body: string } {
  return {
    title: `Restocked: ${currentPercentage}%`,
    body: `${releaseName} is back in stock at ${currentPercentage}% — grab it before it sells out again.`,
  };
}
