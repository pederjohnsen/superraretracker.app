'use client';

import {useState, useSyncExternalStore} from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { useReleases } from "@/hooks/useReleases";
import { usePushSubscriptionSync } from "@/hooks/usePushSubscriptionSync";

// The Notification API has no change event, so there's nothing to subscribe to -
// we just re-read the current permission whenever the component re-renders.
function subscribeToNothing() {
  return () => {};
}

function getNotificationPermission(): NotificationPermission {
  return typeof Notification !== "undefined" ? Notification.permission : "default";
}

function getServerNotificationPermission(): NotificationPermission {
  return "default";
}

const THRESHOLD_OPTIONS = [50, 40, 30, 25, 20, 15, 10, 5, 2];

// Defaults to the highest threshold that isn't disabled for the release's current
// stock level, so checking a box never submits a threshold above current stock.
function getDefaultThreshold(currentPercentage: number): number {
  return THRESHOLD_OPTIONS.find((option) => option <= currentPercentage) ?? THRESHOLD_OPTIONS[THRESHOLD_OPTIONS.length - 1];
}

export default function Home() {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const notificationPermission = useSyncExternalStore(
    subscribeToNothing,
    getNotificationPermission,
    getServerNotificationPermission,
  );
  const [, forceRerender] = useState(0);
  const { releases, isLoading, error } = useReleases();
  const { subscriptions, setReleaseSubscription, error: subscriptionError } = usePushSubscriptionSync();

  const onClickAllowNotifications = async () => {
    await Notification.requestPermission();
    forceRerender((n) => n + 1);
  }

  const onChangeFilterType = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(event.target.value);
  }

  const filteredReleases = releases.filter(release => typeFilter === "ALL" || release.type === typeFilter);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image
          className={styles.logo}
          src="/logo.svg"
          alt="SuperRareTracker logo"
          width={100}
          height={100}
          priority
        />
        <div className={styles.intro}>
          <h1>
            Super Rare Tracker
          </h1>
          <p>
            Track and get notified when Super Rare Games releases become low in stock.
          </p>
        </div>
        {notificationPermission !== "granted" && (
          <div className={styles.enableNotifications}>
            For this app to work please enable notifications:<br />
            <button onClick={onClickAllowNotifications}>Enable Notifications</button>
          </div>
        )}
        <div className={styles.trackItems}>
          <h2>Track Releases</h2>
          <div className={styles.filterByType}>
            <span>Filter by type:</span>
            <select name="type" id="type" onChange={onChangeFilterType}>
              <option value="ALL">All</option>
              <option value="SWITCH">Switch</option>
              <option value="SWITCH2">Switch 2</option>
              {/* <option value="PS4">PS4</option> */}
              <option value="PS5">PS5</option>
              {/* <option value="XBOX">Xbox</option> */}
            </select>
          </div>
          {isLoading && <p>Loading releases…</p>}
          {error && <p>Failed to load releases: {error.message}</p>}
          {subscriptionError && <p>Failed to sync notification settings: {subscriptionError.message}</p>}
          {filteredReleases?.map(release => {
            const thresholdPercentage = subscriptions[release.id];
            const isSubscribed = thresholdPercentage !== undefined;

            const onChangeSubscribed = (event: React.ChangeEvent<HTMLInputElement>) => {
              setReleaseSubscription(
                release.id,
                event.target.checked ? getDefaultThreshold(release.lastStockPercentage) : null,
              );
            };

            const onChangeThreshold = (event: React.ChangeEvent<HTMLSelectElement>) => {
              setReleaseSubscription(release.id, Number(event.target.value));
            };

            return (
              <div key={`item-${release.key}`} id={`item-${release.key}`} className={styles.trackItem}>
                <div>
                  <input
                    type="checkbox"
                    id={release.key}
                    name={release.key}
                    checked={isSubscribed}
                    onChange={onChangeSubscribed}
                  />
                  <label htmlFor={release.key}><strong>{release.name}</strong></label>
                </div>
                <div>
                  Last checked stock:<strong className="stock-percentage">{release.lastStockPercentage}%</strong>
                </div>
                <div>
                  <span>Notify me below:</span>
                  <select
                    id={`percentage-${release.key}`}
                    name={`percentage-${release.key}`}
                    value={thresholdPercentage ?? getDefaultThreshold(release.lastStockPercentage)}
                    disabled={!isSubscribed}
                    onChange={onChangeThreshold}
                  >
                    <option value="50" disabled={release.lastStockPercentage < 50 ? true : false}>50%</option>
                    <option value="40" disabled={release.lastStockPercentage < 40 ? true : false}>40%</option>
                    <option value="30" disabled={release.lastStockPercentage < 30 ? true : false}>30%</option>
                    <option value="25" disabled={release.lastStockPercentage < 25 ? true : false}>25%</option>
                    <option value="20" disabled={release.lastStockPercentage < 20 ? true : false}>20%</option>
                    <option value="15" disabled={release.lastStockPercentage < 15 ? true : false}>15%</option>
                    <option value="10" disabled={release.lastStockPercentage < 10 ? true : false}>10%</option>
                    <option value="5" disabled={release.lastStockPercentage < 5 ? true : false}>5%</option>
                    <option value="2" disabled={release.lastStockPercentage < 2 ? true : false}>2%</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
