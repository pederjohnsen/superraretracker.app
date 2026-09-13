'use client';

import {useState} from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { useReleases } from "@/hooks/useReleases";

export default function Home() {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const { releases, isLoading, error } = useReleases();

  const onClickAllowNotifications = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notifications enabled")
    } else {
      console.log("Permission denied")
    }
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
          <div className={styles.enableNotifications}>
            Enable Notifications<br />
            <button onClick={onClickAllowNotifications}>Allow</button>
          </div>
        </div>
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
          {filteredReleases?.map(release => (
              <div key={`item-${release.key}`} id={`item-${release.key}`} className={styles.trackItem}>
                <div>
                  <input type="checkbox" id={release.key} name={release.key} value={release.key} />
                  <label htmlFor={release.key}><strong>{release.name}</strong></label>
                </div>
                <div>
                  Last checked stock:<strong className="stock-percentage">{release.lastStockPercentage}%</strong>
                </div>
                <div>
                  <span>Notify me below:</span>
                  <select id={`percentage-${release.key}`} name={`percentage-${release.key}`}>
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
            )
          )}
        </div>
      </main>
    </div>
  );
}
