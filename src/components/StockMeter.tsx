import type { ComponentType, ReactNode, SVGProps } from "react";
import { CircleCheck, CircleHelp, CircleSlash, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayTime, formatFullDateTime, formatTimeAgo } from "@/lib/format";
import { getStockTier, NOT_ON_SALE_LABEL, STOCK_LABEL, type StockTier } from "@/lib/stock";
import type { SentAlert } from "@/hooks/usePushSubscriptionSync";

// Lucide has no half-filled circle, so Getting low draws its own.
function CircleHalf(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

type TierStyle = { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; bar: string };

const TIER_STYLE: Record<StockTier, TierStyle> = {
  ok: { icon: CircleCheck, label: "text-stock-ok-foreground", bar: "bg-stock-ok" },
  "getting-low": { icon: CircleHalf, label: "text-stock-warn", bar: "bg-stock-warn" },
  low: { icon: TriangleAlert, label: "text-stock-low-foreground", bar: "bg-stock-low" },
  "very-low": { icon: TriangleAlert, label: "text-stock-low-foreground", bar: "bg-stock-low" },
  critical: { icon: TriangleAlert, label: "font-semibold text-stock-low-foreground", bar: "bg-stock-low" },
  "sold-out": { icon: CircleSlash, label: "text-subtle-foreground", bar: "bg-stock-out" },
  unknown: { icon: CircleHelp, label: "text-subtle-foreground", bar: "bg-stock-out" },
};

type StockMeterProps = {
  /** 0–100, or null when there's no reading. */
  stock: number | null;
  /** For the meter's accessible name. */
  releaseTitle: string;
  /** The last successful stock check. */
  checkedAt: string | null;
  /** When stock goes on sale, while that's still ahead. */
  liveAt: string | null;
  /** The store shows no stock bar for this product. */
  stockNotShown?: boolean;
  /** The alert level, when tracked. */
  threshold?: number;
  /** The last alert sent for this release, when tracked. */
  sentAlert?: SentAlert;
  /** The current time, for relative captions; null on the server. */
  now: number | null;
};

/**
 * How much of a release is left: tier label, percentage, a 6px bar, the alert
 * marker when tracked, and a one-line caption that never changes the height.
 * The tier comes from the same function as the push notification wording.
 */
export function StockMeter({ stock, releaseTitle, checkedAt, liveAt, stockNotShown, threshold, sentAlert, now }: StockMeterProps) {
  const notOnSale = liveAt !== null;
  const tier = notOnSale ? "unknown" : getStockTier(stock);
  const { icon: Icon, label: labelClass, bar } = notOnSale
    ? { ...TIER_STYLE.unknown, icon: Clock }
    : TIER_STYLE[tier];
  const label = notOnSale ? NOT_ON_SALE_LABEL : STOCK_LABEL[tier];
  const value = notOnSale || stock === null ? null : Math.min(100, Math.max(0, stock));

  const valueText = notOnSale
    ? NOT_ON_SALE_LABEL
    : value === null
      ? "Stock level not available"
      : `${value}% left, ${label.toLowerCase()}`;

  const showMarker = threshold !== undefined && !notOnSale && tier !== "sold-out";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", labelClass)}>
          <Icon aria-hidden className="size-3.5" strokeWidth={2.4} />
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{value === null ? "—" : `${value}%`}</span>
      </div>
      <div
        role="meter"
        aria-label={`Stock remaining for ${releaseTitle}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
        aria-valuetext={valueText}
        className="relative h-1.5"
      >
        <div className="h-full overflow-hidden rounded-full bg-secondary">
          {value !== null && <div className={cn("h-full rounded-full", bar)} style={{ width: `${value}%` }} />}
        </div>
        {showMarker && (
          <div
            aria-hidden
            className="absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full bg-marker ring-2 ring-card"
            style={{ left: `${threshold}%` }}
          />
        )}
      </div>
      <Caption
        liveAt={liveAt}
        checkedAt={checkedAt}
        sentAlert={threshold !== undefined ? sentAlert : undefined}
        watchingForRestock={threshold !== undefined && tier === "sold-out"}
        stockNotShown={!liveAt && stock === null && stockNotShown === true}
        now={now}
      />
    </div>
  );
}

function Caption({
  liveAt,
  checkedAt,
  sentAlert,
  now,
  watchingForRestock,
  stockNotShown,
}: Pick<StockMeterProps, "liveAt" | "checkedAt" | "sentAlert" | "now"> & { watchingForRestock: boolean; stockNotShown: boolean }) {
  let content: ReactNode = null;
  let subtle = false;

  if (liveAt) {
    content = (
      <>
        Stock goes live <time dateTime={liveAt} title={formatFullDateTime(liveAt)}>{formatDayTime(liveAt)}</time>
      </>
    );
  } else if (stockNotShown) {
    content = "The store doesn’t show stock for this one";
  } else if (watchingForRestock && now !== null) {
    content = (
      <>
        Watching for a restock
        {checkedAt && (
          <>
            {" "}
            <span aria-hidden>·</span> checked{" "}
            <time dateTime={checkedAt} title={formatFullDateTime(checkedAt)}>
              {formatTimeAgo(checkedAt, now)}
            </time>
          </>
        )}
      </>
    );
  } else if (sentAlert && now !== null) {
    subtle = true;
    content = (
      <>
        Alert sent{sentAlert.percentage !== null && ` at ${sentAlert.percentage}%`} <span aria-hidden>·</span>{" "}
        <time dateTime={sentAlert.sentAt} title={formatFullDateTime(sentAlert.sentAt)}>
          {formatTimeAgo(sentAlert.sentAt, now)}
        </time>
      </>
    );
  } else if (!checkedAt) {
    content = "Not checked yet";
  } else if (now !== null) {
    content = (
      <>
        Checked{" "}
        <time dateTime={checkedAt} title={formatFullDateTime(checkedAt)}>
          {formatTimeAgo(checkedAt, now)}
        </time>
      </>
    );
  }

  return (
    // Not a live region: it ticks every minute on every card, which a screen
    // reader would read out constantly.
    <p
      className={cn("m-0 h-4 truncate text-xs leading-4", subtle ? "text-subtle-foreground" : "text-muted-foreground")}
    >
      {content}
    </p>
  );
}
