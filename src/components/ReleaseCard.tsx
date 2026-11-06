"use client";

import { useState } from "react";
import { Bell, BellOff, BellRing, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StockMeter } from "@/components/StockMeter";
import type { ReleaseDto } from "@/hooks/useReleases";
import type { SentAlert } from "@/hooks/usePushSubscriptionSync";
import { formatDate, formatPrice } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/platform";
import { getDefaultThreshold, getStockTier, THRESHOLD_OPTIONS } from "@/lib/stock";
import { cn } from "@/lib/utils";

type ReleaseCardProps = {
  release: ReleaseDto;
  /** The alert level, or undefined when not tracked. */
  threshold: number | undefined;
  sentAlert: SentAlert | undefined;
  /** Notifications are on, so tracking is possible. */
  canTrack: boolean;
  onThresholdChange: (threshold: number | null) => void;
  now: number | null;
};

/**
 * One release: cover, badges, title, price and date, the stock meter, and one
 * action row. Tracking swaps the Track button for the alert-level select at the
 * same size, so the card never changes height.
 */
export function ReleaseCard({ release, threshold, sentAlert, canTrack, onThresholdChange, now }: ReleaseCardProps) {
  const tracked = threshold !== undefined;
  const headingId = `release-${release.key}`;
  // Before launch any reading is stale, so every alert level is allowed.
  const stock = release.stockLiveAt ? null : release.lastStockPercentage;
  const soldOut = getStockTier(stock) === "sold-out";

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "flex flex-1 flex-col gap-3 rounded-md border bg-card p-3 text-card-foreground",
        tracked && "border-primary/60",
      )}
    >
      <div className="flex gap-3">
        <Cover src={release.coverUrl} fallback={release.catalogue ?? release.title} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            {release.catalogue && <Badge variant="catalogue">{release.catalogue}</Badge>}
            <Badge variant="platform">{PLATFORM_LABEL[release.type]}</Badge>
            {release.edition && <Badge variant="edition">{release.edition}</Badge>}
            {release.reprint && <Badge variant="edition">Reprint</Badge>}
            {release.unsealed && <Badge variant="platform">Unsealed</Badge>}
          </div>
          <h2 id={headingId} className="m-0 line-clamp-2 text-sm leading-snug font-semibold">
            {release.title}
          </h2>
          <p className="m-0 text-xs text-muted-foreground">
            {release.pricePence !== null && (
              <>
                {formatPrice(release.pricePence)} <span aria-hidden>·</span>{" "}
              </>
            )}
            <time dateTime={release.releaseDate}>{formatDate(release.releaseDate)}</time>
          </p>
        </div>
      </div>

      <StockMeter
        stock={release.lastStockPercentage}
        releaseTitle={release.title}
        checkedAt={release.lastCheckedAt}
        liveAt={release.stockLiveAt}
        stockNotShown={release.stockNotShown}
        threshold={threshold}
        sentAlert={sentAlert}
        now={now}
      />

      <div className="mt-auto flex gap-2">
        {tracked && soldOut ? (
          <>
            {/* Nothing to choose while sold out: the restock alert goes to everyone tracking it. */}
            <p className="m-0 inline-flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-primary bg-primary/15 px-3 text-sm font-medium sm:h-9">
              <BellRing aria-hidden className="size-4 shrink-0" />
              <span className="truncate">Restock alert on</span>
            </p>
            <StopTrackingButton title={release.title} onClick={() => onThresholdChange(null)} />
          </>
        ) : tracked ? (
          <>
            <label htmlFor={`threshold-${release.key}`} className="sr-only">
              Alert me when stock for {release.title} is at or below
            </label>
            <NativeSelect
              id={`threshold-${release.key}`}
              variant="tracked"
              className="min-w-0 flex-1"
              value={threshold}
              onChange={(event) => onThresholdChange(Number(event.target.value))}
            >
              {THRESHOLD_OPTIONS.map((option) => (
                <NativeSelectOption
                  key={option}
                  value={option}
                  // Levels above current stock would fire straight away.
                  disabled={stock !== null && stock < option && option !== threshold}
                >
                  Alert at {option}%
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <StopTrackingButton title={release.title} onClick={() => onThresholdChange(null)} />
          </>
        ) : soldOut ? (
          // Tracking a sold-out release means waiting for a restock. The alert level is
          // the lowest, so once it's back the stock alert only fires if it nearly sells out again.
          <Button
            className="min-w-0 flex-1"
            disabled={!canTrack}
            onClick={() => onThresholdChange(getDefaultThreshold(stock))}
            aria-label={`Alert on restock of ${release.title}`}
          >
            <BellRing aria-hidden />
            Alert on restock
          </Button>
        ) : (
          <Button
            className="min-w-0 flex-1"
            // With no stock level on the store, no alert could ever fire.
            disabled={!canTrack || release.stockNotShown}
            onClick={() => onThresholdChange(getDefaultThreshold(stock))}
            // Starts with the visible word, so voice control ("click Track") still works.
            aria-label={`Track ${release.title}`}
          >
            <Bell aria-hidden />
            Track
          </Button>
        )}
        <Button variant="outline" asChild>
          <a
            href={release.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Store: ${release.title} on Super Rare Games (opens in a new tab)`}
          >
            Store
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}

function StopTrackingButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="icon" aria-label={`Stop tracking ${title}`} title="Stop tracking" onClick={onClick}>
      <BellOff aria-hidden />
    </Button>
  );
}

/** A 96px 3:4 cover. Shows the catalogue number while the image is missing or fails. */
function Cover({ src, fallback }: { src: string | null; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-md bg-muted">
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center p-1 text-center font-mono text-[10px] leading-tight text-muted-foreground"
      >
        {fallback}
      </span>
      {src && !failed && (
        // Shopify already resizes the image, so next/image would only add a second pass.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full bg-muted object-contain"
        />
      )}
    </div>
  );
}
