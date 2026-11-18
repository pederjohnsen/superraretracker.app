'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { ReleaseCard } from "@/components/ReleaseCard";
import { SetupGate } from "@/components/SetupGate";
import { UnseenSummary, type UnseenSummaryItem } from "@/components/UnseenSummary";
import { useDeviceSetup } from "@/hooks/useDeviceSetup";
import { useNow } from "@/hooks/useNow";
import { usePushSubscriptionSync, type UnseenAlert } from "@/hooks/usePushSubscriptionSync";
import { useReleases } from "@/hooks/useReleases";
import { useStoredState } from "@/hooks/useStoredState";
import { formatTimeAgo } from "@/lib/format";
import { PLATFORM_LABEL, PLATFORM_ORDER } from "@/lib/platform";
import { describeAlert } from "@/lib/stock";
import type { ReleaseType } from "../../zenstack/models";
import {
  filterReleases,
  formatPlatformSelection,
  formatPublisherSelection,
  listPublishers,
  parsePublisherSelection,
  isSortOrder,
  parsePlatformSelection,
  sortReleases,
  type SortOrder,
} from "@/lib/release-list";

// The platform key is the one the old page used. It now holds a list ("SWITCH2,PS5"),
// and an old single platform reads as a list of one, so saved filters carry over.
const PLATFORM_STORAGE_KEY = "superraretracker.typeFilter";
const SORT_STORAGE_KEY = "superraretracker.sort";
const IN_STOCK_ONLY_STORAGE_KEY = "superraretracker.inStockOnly";
const TRACKED_ONLY_STORAGE_KEY = "superraretracker.trackedOnly";
const PUBLISHER_STORAGE_KEY = "superraretracker.publishers";
const isString = (value: string): value is string => typeof value === "string";
const isBooleanString = (value: string): value is "true" | "false" => value === "true" || value === "false";
const isPlatformSelection = (value: string): value is string => parsePlatformSelection(value) !== null;
// How long a card stays outlined after jumping to it.
const HIGHLIGHT_MS = 4_000;

export default function Home() {
  const setup = useDeviceSetup();
  const { permission } = setup;
  const { releases, isLoading, error } = useReleases();
  const {
    subscriptions,
    sentAlerts,
    unseenAlerts,
    dismissAlerts,
    setReleaseSubscription,
    sendTestAlert,
    isReady,
    error: subscriptionError,
  } = usePushSubscriptionSync(permission);
  const now = useNow();

  const [search, setSearch] = useState("");
  const [platformValue, setPlatformValue] = useStoredState(PLATFORM_STORAGE_KEY, "ALL", isPlatformSelection);
  const [sort, setSort] = useStoredState<SortOrder>(SORT_STORAGE_KEY, "date-desc", isSortOrder);
  const [inStockOnlyValue, setInStockOnlyValue] = useStoredState(IN_STOCK_ONLY_STORAGE_KEY, "false", isBooleanString);
  const inStockOnly = inStockOnlyValue === "true";
  const [trackedOnlyValue, setTrackedOnlyValue] = useStoredState(TRACKED_ONLY_STORAGE_KEY, "false", isBooleanString);
  const trackedOnly = trackedOnlyValue === "true";

  // Only offer platforms that have releases, so the filter grows with the catalogue.
  const platforms = useMemo(
    () => PLATFORM_ORDER.filter((type) => releases.some((release) => release.type === type)),
    [releases],
  );
  // Only the picked platforms that still have releases count, so a saved pick
  // with no toggle on screen can't hide the whole list.
  const selectedPlatforms = useMemo(() => {
    const saved = parsePlatformSelection(platformValue) ?? [];
    return isLoading ? saved : saved.filter((type) => platforms.includes(type));
  }, [platformValue, platforms, isLoading]);
  const setSelectedPlatforms = (next: ReleaseType[]) => setPlatformValue(formatPlatformSelection(next));

  // Publishers work the same way: only ones with releases are offered or count.
  const [publisherValue, setPublisherValue] = useStoredState(PUBLISHER_STORAGE_KEY, "ALL", isString);
  const publishers = useMemo(() => listPublishers(releases), [releases]);
  const selectedPublishers = useMemo(() => {
    const saved = parsePublisherSelection(publisherValue);
    return isLoading ? saved : saved.filter((key) => publishers.some((publisher) => publisher.key === key));
  }, [publisherValue, publishers, isLoading]);
  const setSelectedPublishers = (next: string[]) => setPublisherValue(formatPublisherSelection(next));

  // Unseen alerts by release; a release with several shows its latest.
  const alertsByRelease = useMemo(() => {
    const map = new Map<string, UnseenAlert[]>();
    for (const alert of unseenAlerts) map.set(alert.releaseId, [...(map.get(alert.releaseId) ?? []), alert]);
    for (const alerts of map.values()) alerts.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return map;
  }, [unseenAlerts]);

  const visibleReleases = useMemo(() => {
    const sorted = sortReleases(
      filterReleases(releases, {
        search,
        platforms: selectedPlatforms,
        publishers: selectedPublishers,
        inStockOnly,
        trackedOnly,
        isTracked: (release) => subscriptions[release.id] !== undefined,
      }),
      sort,
    );
    // Releases with a new alert come first, otherwise in the chosen order.
    return [
      ...sorted.filter((release) => alertsByRelease.has(release.id)),
      ...sorted.filter((release) => !alertsByRelease.has(release.id)),
    ];
  }, [releases, search, selectedPlatforms, selectedPublishers, inStockOnly, trackedOnly, subscriptions, sort, alertsByRelease]);

  // One line per release in the strip, newest first.
  const summaryItems = useMemo<UnseenSummaryItem[]>(
    () =>
      releases
        .filter((release) => alertsByRelease.has(release.id))
        .map((release) => ({ release, latest: alertsByRelease.get(release.id)![0] }))
        .sort((a, b) => b.latest.sentAt.localeCompare(a.latest.sentAt))
        .map(({ release, latest }) => ({
          releaseKey: release.key,
          title: release.title,
          detail: [release.catalogue ?? release.edition, PLATFORM_LABEL[release.type]].filter(Boolean).join(" · "),
          text: describeAlert(latest.kind, latest.percentage).summary,
          when: now === null ? "" : formatTimeAgo(latest.sentAt, now),
        })),
    [releases, alertsByRelease, now],
  );

  const trackedCount = releases.filter((release) => subscriptions[release.id] !== undefined).length;
  const hasFilters =
    search.trim() !== "" || selectedPlatforms.length > 0 || selectedPublishers.length > 0 || inStockOnly || trackedOnly;

  const clearFilters = () => {
    setSearch("");
    setSelectedPlatforms([]);
    setSelectedPublishers([]);
    setInStockOnlyValue("false");
    setTrackedOnlyValue("false");
  };

  // Someone who sets up during this visit sees "You're all set" before the list.
  // Anyone who already has notifications on goes straight to the list.
  const [setUpThisVisit, setSetUpThisVisit] = useState(false);
  const [finishedSetup, setFinishedSetup] = useState(false);
  if (setup.ready && permission !== "granted" && !setUpThisVisit) setSetUpThisVisit(true);

  // Jumping to a card: from the alerts strip, a notification tapped while the
  // app is open, or `?release=` when a notification opens the app.
  // A notification that opened the app passes its release as `?release=`. Read
  // once on the client; nothing rendered depends on it, so hydration matches.
  const [pendingJump, setPendingJump] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("release"),
  );
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const clearedFiltersForRef = useRef<string | null>(null);
  const jumpTo = useCallback((key: string) => {
    clearedFiltersForRef.current = null;
    setPendingJump(key);
  }, []);

  // A notification tapped while the app is open: the service worker focuses this window and says which release.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-release" && typeof event.data.key === "string") jumpTo(event.data.key);
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [jumpTo]);

  const listShown = setup.ready && permission === "granted" && (!setUpThisVisit || finishedSetup);
  useEffect(() => {
    if (!pendingJump || isLoading || !listShown) return;
    // After the frame is painted, so the card is in the DOM and laid out.
    const frame = requestAnimationFrame(() => jump(pendingJump));
    return () => cancelAnimationFrame(frame);

    function jump(key: string) {
      const done = () => {
        setPendingJump(null);
        // Drop ?release= so a reload doesn't jump again.
        const url = new URL(window.location.href);
        if (url.searchParams.has("release")) {
          url.searchParams.delete("release");
          window.history.replaceState(window.history.state, "", url);
        }
      };

      if (!releases.some((release) => release.key === key)) return done();
      // Hidden by the filters: clear them once, then try again on the next render.
      if (!visibleReleases.some((release) => release.key === key)) {
        if (clearedFiltersForRef.current === key) return done();
        clearedFiltersForRef.current = key;
        clearFilters();
        return;
      }

      const item = document.getElementById(`item-${key}`);
      if (!item) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      item.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      document.getElementById(`release-${key}`)?.focus({ preventScroll: true });
      setHighlightedKey(key);
      done();
    }
    // clearFilters only sets state, so leaving it out of the deps is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJump, isLoading, listShown, releases, visibleReleases]);

  useEffect(() => {
    if (!highlightedKey) return;
    const timer = setTimeout(() => setHighlightedKey(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedKey]);

  const dismissAllAlerts = () => {
    dismissAlerts(unseenAlerts.map((alert) => alert.id));
    // The strip and its button go, so put focus somewhere sensible.
    document.getElementById("releases-heading")?.focus();
  };
  const dismissReleaseAlerts = (release: (typeof releases)[number]) => {
    dismissAlerts((alertsByRelease.get(release.id) ?? []).map((alert) => alert.id));
    // The card moves out of the "new" group, so follow it.
    requestAnimationFrame(() => document.getElementById(`release-${release.key}`)?.focus());
  };

  // Nothing about the device is known until hydration, so show neither screen yet.
  if (!setup.ready) return <main className="flex-1" />;
  if (permission !== "granted" || (setUpThisVisit && !finishedSetup)) {
    return (
      <SetupGate
        setup={setup}
        onSendTestAlert={sendTestAlert}
        onFinish={() => {
          setFinishedSetup(true);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <>
      <a
        href="#releases-heading"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-30 focus:rounded-md focus:bg-ring focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to releases
      </a>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5">
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

          <UnseenSummary items={summaryItems} onJump={jumpTo} onDismiss={dismissAllAlerts} />

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            platforms={platforms}
            selectedPlatforms={selectedPlatforms}
            onSelectedPlatformsChange={setSelectedPlatforms}
            publishers={publishers}
            selectedPublishers={selectedPublishers}
            onSelectedPublishersChange={setSelectedPublishers}
            sort={sort}
            onSortChange={setSort}
            inStockOnly={inStockOnly}
            onInStockOnlyChange={(value) => setInStockOnlyValue(value ? "true" : "false")}
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
              {visibleReleases.map((release) => {
                const latestAlert = alertsByRelease.get(release.id)?.[0];
                return (
                  <li key={release.key} id={`item-${release.key}`} className="flex">
                    <ReleaseCard
                      release={release}
                      threshold={subscriptions[release.id]}
                      // The New strip already says what was sent, so the caption goes back to "Checked …".
                      sentAlert={latestAlert ? undefined : sentAlerts[release.id]}
                      canTrack={isReady}
                      onThresholdChange={(threshold) => setReleaseSubscription(release.id, threshold)}
                      now={now}
                      highlighted={highlightedKey === release.key}
                      newAlert={
                        latestAlert && {
                          text: [
                            describeAlert(latestAlert.kind, latestAlert.percentage).card,
                            now === null ? null : formatTimeAgo(latestAlert.sentAt, now),
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          onDismiss: () => dismissReleaseAlerts(release),
                        }
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            !error && (
              <EmptyState
                trackedOnly={trackedOnly}
                inStockOnly={inStockOnly}
                hasOtherFilters={search.trim() !== "" || selectedPlatforms.length > 0 || selectedPublishers.length > 0}
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
        <li key={index} className="flex h-[228px] gap-3 rounded-md border bg-card p-3 sm:h-[212px]">
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
