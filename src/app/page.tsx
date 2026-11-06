'use client';

import { useMemo, useState, type ReactNode } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { ReleaseCard } from "@/components/ReleaseCard";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useNow } from "@/hooks/useNow";
import { usePushSubscriptionSync } from "@/hooks/usePushSubscriptionSync";
import { useReleases } from "@/hooks/useReleases";
import { useStoredState } from "@/hooks/useStoredState";
import { PLATFORM_ORDER } from "@/lib/platform";
import { filterReleases, isPlatformFilter, isSortOrder, sortReleases, type PlatformFilter, type SortOrder } from "@/lib/release-list";

// The platform key is the one the old page used, so saved filters carry over.
const PLATFORM_STORAGE_KEY = "superraretracker.typeFilter";
const SORT_STORAGE_KEY = "superraretracker.sort";
const TRACKED_ONLY_STORAGE_KEY = "superraretracker.trackedOnly";
const isBooleanString = (value: string): value is "true" | "false" => value === "true" || value === "false";

export default function Home() {
  const { permission, refresh: refreshPermission } = useNotificationPermission();
  const { releases, isLoading, error } = useReleases();
  const { subscriptions, sentAlerts, setReleaseSubscription, isReady, error: subscriptionError } =
    usePushSubscriptionSync(permission);
  const now = useNow();

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useStoredState<PlatformFilter>(PLATFORM_STORAGE_KEY, "ALL", isPlatformFilter);
  const [sort, setSort] = useStoredState<SortOrder>(SORT_STORAGE_KEY, "date-desc", isSortOrder);
  const [trackedOnlyValue, setTrackedOnlyValue] = useStoredState(TRACKED_ONLY_STORAGE_KEY, "false", isBooleanString);
  const trackedOnly = trackedOnlyValue === "true";

  // Only offer platforms that have releases, so the filter grows with the catalogue.
  const platforms = useMemo(
    () => PLATFORM_ORDER.filter((type) => releases.some((release) => release.type === type)),
    [releases],
  );

  const visibleReleases = useMemo(
    () =>
      sortReleases(
        filterReleases(releases, {
          search,
          platform,
          trackedOnly,
          isTracked: (release) => subscriptions[release.id] !== undefined,
        }),
        sort,
      ),
    [releases, search, platform, trackedOnly, subscriptions, sort],
  );

  const trackedCount = releases.filter((release) => subscriptions[release.id] !== undefined).length;
  const hasFilters = search.trim() !== "" || platform !== "ALL" || trackedOnly;

  const clearFilters = () => {
    setSearch("");
    setPlatform("ALL");
    setTrackedOnlyValue("false");
  };

  const onEnableNotifications = async () => {
    await Notification.requestPermission();
    refreshPermission();
  };

  return (
    <>
      <a
        href="#releases-heading"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-30 focus:rounded-md focus:bg-ring focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to releases
      </a>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5">
        {/* Temporary until the setup screen (next PR) puts the list behind notifications. */}
        {permission !== "granted" && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-primary/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm">
              <strong className="font-semibold">Turn on notifications to track releases.</strong>{" "}
              <span className="text-muted-foreground">Alerts are sent as push notifications when stock drops to your level.</span>
            </p>
            <Button onClick={onEnableNotifications} disabled={permission === "denied"} className="shrink-0">
              <BellRing aria-hidden />
              {permission === "denied" ? "Blocked in your settings" : "Turn on notifications"}
            </Button>
          </div>
        )}

        <section aria-labelledby="releases-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 id="releases-heading" tabIndex={-1} className="m-0 text-xl font-semibold tracking-tight">
              Releases
            </h1>
            <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
              {!isLoading && !error && (
                <>
                  {hasFilters ? `Showing ${visibleReleases.length} of ${releases.length}` : `${releases.length} releases`}
                  {trackedCount > 0 && ` · Tracking ${trackedCount}`}
                </>
              )}
            </p>
          </div>

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            platforms={platforms}
            platform={platform}
            onPlatformChange={setPlatform}
            sort={sort}
            onSortChange={setSort}
            trackedOnly={trackedOnly}
            onTrackedOnlyChange={(value) => setTrackedOnlyValue(value ? "true" : "false")}
            resultCount={visibleReleases.length}
            onClearFilters={clearFilters}
          />

          {error && <Message>Couldn’t load releases: {error.message}. Refresh the page to try again.</Message>}
          {subscriptionError && <Message>Couldn’t sync your alerts: {subscriptionError.message}</Message>}

          {isLoading ? (
            <ReleaseGridSkeleton />
          ) : visibleReleases.length > 0 ? (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {visibleReleases.map((release) => (
                <li key={release.key} id={`item-${release.key}`} className="flex">
                  <ReleaseCard
                    release={release}
                    threshold={subscriptions[release.id]}
                    sentAlert={sentAlerts[release.id]}
                    canTrack={isReady}
                    onThresholdChange={(threshold) => setReleaseSubscription(release.id, threshold)}
                    now={now}
                  />
                </li>
              ))}
            </ul>
          ) : (
            !error && (
              <EmptyState
                trackedOnly={trackedOnly}
                hasOtherFilters={search.trim() !== "" || platform !== "ALL"}
                hasTracked={trackedCount > 0}
                onClear={clearFilters}
              />
            )
          )}
        </section>
      </main>
    </>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 rounded-md border border-stock-low/60 px-3 py-2 text-sm text-stock-low-foreground">
      {children}
    </p>
  );
}

// Card-shaped placeholders while releases load, so the page doesn't jump.
function ReleaseGridSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading releases" className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="flex h-[228px] gap-3 rounded-xl border bg-card p-3 sm:h-[212px]">
          <div className="aspect-[3/4] w-24 shrink-0 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        </li>
      ))}
    </ul>
  );
}
