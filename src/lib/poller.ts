import { db } from "@/lib/db";
import { scrapeStockPercentage } from "@/lib/scraper";
import { sendPushNotification } from "@/lib/push";
import { DateTime } from "luxon";

const MIN_INTERVAL_MINUTES = 1;
const DEFAULT_MAX_INTERVAL_MINUTES = 240;
const DEFAULT_INTERVAL_MINUTES = 60;
const UK_TIMEZONE = "Europe/London";
const LAUNCH_POLL_START_MINUTES = 17 * 60 + 55;
const LAUNCH_GRACE_MINUTES = 10;
const LAUNCH_WINDOW_MINUTES = 60;
const LAUNCH_INTERVALS = [1, 2, 5] as const;
// During active selling, poll several times before the projected sellout time.
const SELLOUT_LOOKAHEAD_FRACTION = 0.15;
const SMALL_RESTOCK_THRESHOLD = 5;
// Backoff base for repeated scrape failures (in minutes): 1, 2, 4, 8, ... capped at MAX.
const FAILURE_BACKOFF_BASE_MINUTES = 1;
// Analyze up to 24 checks, but never use readings older than one day.
const HISTORY_SIZE = 24;
const HISTORY_WINDOW_HOURS = 24;
const MIN_TREND_INTERVALS = 3;
// Weight given to the recency-weighted short-term rate vs. the overall trend across the
// full history window when blending (see computeEffectiveDropRatePerHour).
const RECENT_RATE_WEIGHT = 0.65;
// Exponential decay applied to older pairwise intervals when computing the short-term rate.
const RATE_DECAY = 0.6;
// Ratio of most-recent-interval rate to the long-term trend rate that counts as a
// sudden speed-up/slow-down, warranting reacting to the newest signal instead of blending.
const ACCELERATION_RATIO = 1.5;
const DECELERATION_RATIO = 0.5;

// Releases due for a stock check: never checked before, or past their scheduled next poll time.
async function findDueReleases(now: Date) {
  return db.release.findMany({
    where: {
      OR: [{ pollSchedule: null }, { pollSchedule: { nextPollAt: { lte: now } } }],
    },
    include: {
      pollSchedule: true,
      stockChecks: { orderBy: { checkedAt: "desc" }, take: HISTORY_SIZE - 1 },
      subscriptions: { include: { pushSubscription: true } },
    },
  });
}

type DueRelease = Awaited<ReturnType<typeof findDueReleases>>[number];
type StockPoint = { percentage: number; checkedAt: Date };

function getReleaseLaunchAt(releaseDate: Date): Date {
  const launchHour = Math.floor(LAUNCH_POLL_START_MINUTES / 60);
  const launchMinute = LAUNCH_POLL_START_MINUTES % 60;
  const releaseDay = DateTime.fromJSDate(releaseDate, { zone: UK_TIMEZONE });
  return releaseDay.set({ hour: launchHour, minute: launchMinute, second: 0, millisecond: 0 }).toJSDate();
}

function getLaunchIntervalMinutes(launchAt: Date, now: Date): number {
  const elapsedMinutes = Math.max(0, (now.getTime() - launchAt.getTime()) / 60_000);
  if (elapsedMinutes < LAUNCH_GRACE_MINUTES) return LAUNCH_INTERVALS[0];
  if (elapsedMinutes < 30) return LAUNCH_INTERVALS[1];
  return LAUNCH_INTERVALS[2];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getMaxIntervalMinutes(currentPercentage: number): number {
  if (currentPercentage < 5) return 60;
  return DEFAULT_MAX_INTERVAL_MINUTES;
}

// Turns up to HISTORY_SIZE stock readings (newest first) into a single "% per hour"
// drop rate, taking the release's actual polling history into account rather than
// just the last two readings:
// - a recency-weighted average of the recent pairwise rates (reacts quickly to change)
// - the overall rate across the whole window (a stable long-term baseline)
// - if the newest interval is dropping much faster/slower than that baseline, trust
//   the newest interval directly instead of blending, so sudden rushes or lulls are
//   picked up immediately rather than smoothed away.
function computeEffectiveDropRatePerHour(points: StockPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }

  const newestTimestamp = points[0].checkedAt.getTime();
  const historyWindowStart = newestTimestamp - HISTORY_WINDOW_HOURS * 60 * 60 * 1000;
  const recentPoints = points.filter((point) => point.checkedAt.getTime() >= historyWindowStart);
  if (recentPoints.length < 2) {
    return null;
  }

  const pairwiseRates: number[] = [];
  for (let i = 0; i < recentPoints.length - 1; i++) {
    const newer = recentPoints[i];
    const older = recentPoints[i + 1];
    const hours = (newer.checkedAt.getTime() - older.checkedAt.getTime()) / (1000 * 60 * 60);
    if (hours <= 0) continue;
    pairwiseRates.push((older.percentage - newer.percentage) / hours);
  }

  if (pairwiseRates.length < MIN_TREND_INTERVALS) {
    return null;
  }

  let weightedSum = 0;
  let weightTotal = 0;
  pairwiseRates.forEach((rate, i) => {
    const weight = RATE_DECAY ** i;
    weightedSum += rate * weight;
    weightTotal += weight;
  });
  const weightedRecentRate = weightedSum / weightTotal;

  const newest = recentPoints[0];
  const oldest = recentPoints[recentPoints.length - 1];
  const spanHours = (newest.checkedAt.getTime() - oldest.checkedAt.getTime()) / (1000 * 60 * 60);
  const spanRate = spanHours > 0 ? (oldest.percentage - newest.percentage) / spanHours : null;

  const mostRecentRate = pairwiseRates[0];

  if (spanRate === null || spanRate <= 0) {
    // No established long-term trend (flat/restocked overall) - only react if the
    // newest interval itself shows an active drop.
    return mostRecentRate > 0 ? mostRecentRate : 0;
  }

  const accelerationRatio = mostRecentRate / spanRate;
  if (accelerationRatio >= ACCELERATION_RATIO) {
    // Speeding up: trust the newest interval so we react immediately.
    return mostRecentRate;
  }
  if (accelerationRatio <= DECELERATION_RATIO) {
    // Cooling off: lean on the longer-term trend instead of over-relaxing on one quiet interval.
    return spanRate;
  }

  return weightedRecentRate * RECENT_RATE_WEIGHT + spanRate * (1 - RECENT_RATE_WEIGHT);
}

function smallRestockIntervalCap(currentPercentage: number): number {
  if (currentPercentage <= 5) return 5;
  if (currentPercentage <= 10) return 10;
  if (currentPercentage <= 20) return 20;
  if (currentPercentage <= 35) return 30;
  return getMaxIntervalMinutes(currentPercentage);
}

// After the launch window, active stock decline uses both remaining stock and its
// observed rate. Small restocks at low stock stay conservative rather than backing off.
function computeNextPollIntervalMinutes(params: {
  currentPercentage: number;
  previousPercentage: number | null;
  effectiveDropRatePerHour: number | null;
}): number {
  const { currentPercentage, previousPercentage, effectiveDropRatePerHour } = params;
  const maxIntervalMinutes = getMaxIntervalMinutes(currentPercentage);
  if (effectiveDropRatePerHour === null) {
    return Math.min(DEFAULT_INTERVAL_MINUTES, maxIntervalMinutes);
  }

  if (previousPercentage !== null && currentPercentage > previousPercentage) {
    const restockAmount = currentPercentage - previousPercentage;
    if (restockAmount < SMALL_RESTOCK_THRESHOLD) {
      return smallRestockIntervalCap(currentPercentage);
    }
  }

  if (currentPercentage <= 0 || effectiveDropRatePerHour <= 0) return maxIntervalMinutes;

  const hoursToSellOut = currentPercentage / effectiveDropRatePerHour;
  const intervalMinutes = hoursToSellOut * 60 * SELLOUT_LOOKAHEAD_FRACTION;
  return clamp(intervalMinutes, MIN_INTERVAL_MINUTES, maxIntervalMinutes);
}

// Exponential backoff so a broken/blocked URL doesn't get hammered every cron run.
function computeFailureBackoffMinutes(consecutiveFailures: number): number {
  const backoff = FAILURE_BACKOFF_BASE_MINUTES * 2 ** consecutiveFailures;
  return clamp(backoff, MIN_INTERVAL_MINUTES, DEFAULT_MAX_INTERVAL_MINUTES);
}


// Keep titles short across browser and mobile notification layouts; the full name belongs in the body.
function buildStockAlertMessage(releaseName: string, currentPercentage: number): { title: string; body: string } {
  if (currentPercentage < 5) {
    return {
      title: `Stock alert: ${currentPercentage}%`,
      body: `${releaseName}: only ${currentPercentage}% left in stock — grab it before it sells out.`,
    };
  }
  if (currentPercentage <= 10) {
    return {
      title: `Stock alert: ${currentPercentage}%`,
      body: `${releaseName}: stock is getting low at ${currentPercentage}%, but there is still time to decide.`,
    };
  }
  if (currentPercentage <= 25) {
    return {
      title: `Stock alert: ${currentPercentage}%`,
      body: `${releaseName}: stock is down to ${currentPercentage}% — don't wait too long.`,
    };
  }
  return {
    title: `Stock alert: ${currentPercentage}%`,
    body: `${releaseName}: stock has dropped to ${currentPercentage}%, matching the alert you set.`,
  };
}

async function notifyEligibleSubscribers(release: DueRelease, currentPercentage: number) {
  const eligible = release.subscriptions.filter(
    (subscription) => subscription.notifiedAt === null && currentPercentage <= subscription.thresholdPercentage,
  );

  let notifiedCount = 0;
  for (const subscription of eligible) {
    try {
      const { title, body } = buildStockAlertMessage(release.name, currentPercentage);
      await sendPushNotification(subscription.pushSubscription, {
        title,
        body,
        url: release.url,
      });
      await db.releaseSubscription.update({
        where: { id: subscription.id },
        data: { notifiedAt: new Date() },
      });
      notifiedCount++;
    } catch (err) {
      console.error(`Failed to notify subscription ${subscription.id} for release ${release.key}:`, err);
    }
  }

  return notifiedCount;
}

async function pollRelease(release: DueRelease, now: Date) {
  const previousConsecutiveFailures = release.pollSchedule?.consecutiveFailures ?? 0;
  const launchAt = getReleaseLaunchAt(release.releaseDate);

  if (now < launchAt) {
    await db.releasePollSchedule.upsert({
      where: { releaseId: release.id },
      create: {
        releaseId: release.id,
        nextPollAt: launchAt,
        intervalMinutes: LAUNCH_INTERVALS[0],
        consecutiveFailures: 0,
      },
      update: {
        nextPollAt: launchAt,
        intervalMinutes: LAUNCH_INTERVALS[0],
        consecutiveFailures: 0,
      },
    });

    return {
      releaseId: release.id,
      key: release.key,
      success: true as const,
      skipped: true as const,
      reason: "before-release-window",
      nextPollAt: launchAt.toISOString(),
    };
  }

  const minutesSinceLaunch = (now.getTime() - launchAt.getTime()) / 60_000;

  let currentPercentage: number | null;
  try {
    currentPercentage = await scrapeStockPercentage(release.url);
  } catch (err) {
    // Reschedule with backoff instead of leaving the release perpetually "due" and
    // hammering a broken/blocked URL on every cron run.
    const consecutiveFailures = previousConsecutiveFailures + 1;
    const intervalMinutes = computeFailureBackoffMinutes(consecutiveFailures);
    const nextPollAt = new Date(now.getTime() + intervalMinutes * 60_000);

    await db.releasePollSchedule.upsert({
      where: { releaseId: release.id },
      create: { releaseId: release.id, nextPollAt, intervalMinutes, lastPolledAt: now, consecutiveFailures },
      update: { nextPollAt, intervalMinutes, lastPolledAt: now, consecutiveFailures },
    });

    throw err;
  }

  if (currentPercentage === null) {
    if (minutesSinceLaunch < LAUNCH_WINDOW_MINUTES) {
      const intervalMinutes = getLaunchIntervalMinutes(launchAt, now);
      const nextPollAt = new Date(now.getTime() + intervalMinutes * 60_000);

      await db.releasePollSchedule.upsert({
        where: { releaseId: release.id },
        create: { releaseId: release.id, nextPollAt, intervalMinutes, lastPolledAt: now, consecutiveFailures: 0 },
        update: { nextPollAt, intervalMinutes, lastPolledAt: now, consecutiveFailures: 0 },
      });

      return {
        releaseId: release.id,
        key: release.key,
        success: true as const,
        stockAvailable: false as const,
        intervalMinutes,
        nextPollAt: nextPollAt.toISOString(),
      };
    }

    throw new Error(`No stock percentage found`);
  }

  const previousCheck = release.stockChecks[0] as StockPoint | undefined;
  const previousPercentage = previousCheck ? previousCheck.percentage : null;

  // Newest-first history including the reading we just took, feeding the trend analysis.
  const history: StockPoint[] = [{ percentage: currentPercentage, checkedAt: now }, ...release.stockChecks];
  const effectiveDropRatePerHour = computeEffectiveDropRatePerHour(history);

  await db.stockCheck.create({
    data: { releaseId: release.id, percentage: currentPercentage, checkedAt: now },
  });
  await db.release.update({
    where: { id: release.id },
    data: { lastStockPercentage: currentPercentage },
  });

  const intervalMinutes = minutesSinceLaunch < LAUNCH_WINDOW_MINUTES
    ? getLaunchIntervalMinutes(launchAt, now)
    : computeNextPollIntervalMinutes({ currentPercentage, previousPercentage, effectiveDropRatePerHour });
  const nextPollAt = new Date(now.getTime() + intervalMinutes * 60_000);

  await db.releasePollSchedule.upsert({
    where: { releaseId: release.id },
    create: { releaseId: release.id, nextPollAt, intervalMinutes, lastPolledAt: now, consecutiveFailures: 0 },
    update: { nextPollAt, intervalMinutes, lastPolledAt: now, consecutiveFailures: 0 },
  });

  const notified = await notifyEligibleSubscribers(release, currentPercentage);

  return {
    releaseId: release.id,
    key: release.key,
    success: true as const,
    previousPercentage,
    currentPercentage,
    intervalMinutes,
    nextPollAt: nextPollAt.toISOString(),
    notified,
  };
}

export async function runPollingCycle() {
  const now = new Date();
  const dueReleases = await findDueReleases(now);

  const results = await Promise.all(
    dueReleases.map(async (release) => {
      try {
        return await pollRelease(release, now);
      } catch (err) {
        console.error(`Failed to poll release ${release.key}:`, err);
        return {
          releaseId: release.id,
          key: release.key,
          success: false as const,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),
  );

  return {
    checkedAt: now.toISOString(),
    polled: results.length,
    results,
  };
}
