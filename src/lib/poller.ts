import { db } from "@/lib/db";
import { scrapeStockPercentage } from "@/lib/scraper";
import { sendPushNotification } from "@/lib/push";

const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 240;
const SOLD_OUT_INTERVAL_MINUTES = 1440;
// No history yet for this release; check back at a moderate pace until we have a trend.
const DEFAULT_INTERVAL_MINUTES = 60;
// Once we know the drop rate, aim to re-check after this fraction of the estimated
// remaining time-to-sellout, so we get several samples before stock actually hits 0.
const SELLOUT_LOOKAHEAD_FRACTION = 0.15;
// Backoff base for repeated scrape failures (in minutes): 1, 2, 4, 8, ... capped at MAX.
const FAILURE_BACKOFF_BASE_MINUTES = 1;
// How many recent stock checks (plus the one we're about to take) feed the trend analysis.
const HISTORY_SIZE = 6;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// The lower the remaining stock, the more eagerly we poll, regardless of trend -
// a slow drip can turn into a bulk purchase at any time once stock is scarce.
function lowStockIntervalCeilingMinutes(currentPercentage: number): number {
  if (currentPercentage <= 5) return 2;
  if (currentPercentage <= 10) return 5;
  if (currentPercentage <= 20) return 15;
  if (currentPercentage <= 35) return 30;
  if (currentPercentage <= 50) return 60;
  return MAX_INTERVAL_MINUTES;
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

  const pairwiseRates: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const newer = points[i];
    const older = points[i + 1];
    const hours = (newer.checkedAt.getTime() - older.checkedAt.getTime()) / (1000 * 60 * 60);
    if (hours <= 0) continue;
    pairwiseRates.push((older.percentage - newer.percentage) / hours);
  }

  if (pairwiseRates.length === 0) {
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

  const newest = points[0];
  const oldest = points[points.length - 1];
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

// Faster stock drops => shorter interval. Instead of fixed buckets, we estimate how
// long until the release sells out at its current (history-informed) drop rate and
// re-check well before that, so the polling frequency scales continuously with urgency.
function computeNextPollIntervalMinutes(params: {
  currentPercentage: number;
  effectiveDropRatePerHour: number | null;
}): number {
  const { currentPercentage, effectiveDropRatePerHour } = params;

  if (currentPercentage <= 0) {
    return SOLD_OUT_INTERVAL_MINUTES;
  }

  if (effectiveDropRatePerHour === null) {
    return DEFAULT_INTERVAL_MINUTES;
  }

  let intervalMinutes: number;
  if (effectiveDropRatePerHour <= 0) {
    // Stable or restocked: ease off, but low-stock ceiling below still applies.
    intervalMinutes = MAX_INTERVAL_MINUTES;
  } else {
    const hoursToSellOut = currentPercentage / effectiveDropRatePerHour;
    intervalMinutes = hoursToSellOut * 60 * SELLOUT_LOOKAHEAD_FRACTION;
  }

  intervalMinutes = Math.min(intervalMinutes, lowStockIntervalCeilingMinutes(currentPercentage));

  return clamp(intervalMinutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES);
}

// Exponential backoff so a broken/blocked URL doesn't get hammered every cron run.
function computeFailureBackoffMinutes(consecutiveFailures: number): number {
  const backoff = FAILURE_BACKOFF_BASE_MINUTES * 2 ** consecutiveFailures;
  return clamp(backoff, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES);
}


// Copy tone scales with how low stock actually is, since a subscriber alerted at
// 50% shouldn't be told a release is "almost gone" when it's simply below their threshold.
function buildStockAlertMessage(releaseName: string, currentPercentage: number): { title: string; body: string } {
  if (currentPercentage <= 10) {
    return {
      title: `${releaseName} is almost gone`,
      body: `Only ${currentPercentage}% left in stock — grab it before it sells out.`,
    };
  }
  if (currentPercentage <= 25) {
    return {
      title: `${releaseName} is selling fast`,
      body: `Stock is down to ${currentPercentage}% — don't wait too long.`,
    };
  }
  return {
    title: `${releaseName} stock is dropping`,
    body: `Stock has dropped to ${currentPercentage}%, matching the alert you set.`,
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

  let currentPercentage: number;
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

  const intervalMinutes = computeNextPollIntervalMinutes({
    currentPercentage,
    effectiveDropRatePerHour,
  });
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
