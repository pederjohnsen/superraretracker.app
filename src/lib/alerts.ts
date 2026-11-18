import type { AlertKind } from "../../zenstack/models";
import { db } from "@/lib/db";
import { sendPushNotification, type PushSubscriptionKeys } from "@/lib/push";

// Records an alert for a device and sends its push notification. Every stock
// and restock alert goes through here, so the app can later show the ones a
// device hasn't seen (see the unseen-alerts plan in the project).

/** How long alerts are kept. Older ones are deleted by the monitor. */
export const ALERT_RETENTION_DAYS = 30;

type AlertTarget = {
  /** The device's PushSubscription id. */
  pushSubscriptionId: string;
  pushSubscription: PushSubscriptionKeys;
};

type AlertDetails = { kind: AlertKind; percentage: number; title: string; body: string };

/**
 * Saves the alert, then sends the push. If saving fails, nothing is sent and
 * the error is thrown, so the caller can try again on the next poll. If only
 * the push fails, the alert is kept, so the app still shows it next time it's
 * opened, and `pushError` says what went wrong.
 */
export async function recordAndSendAlert(
  target: AlertTarget,
  release: { id: string; key: string },
  alert: AlertDetails,
): Promise<{ pushError: unknown | null }> {
  await db.alert.create({
    data: {
      kind: alert.kind,
      percentage: alert.percentage,
      releaseId: release.id,
      pushSubscriptionId: target.pushSubscriptionId,
    },
  });

  try {
    // For the app icon's badge: everything this device hasn't seen, including this one.
    const unseenCount = await db.alert.count({ where: { pushSubscriptionId: target.pushSubscriptionId, seenAt: null } });
    await sendPushNotification(target.pushSubscription, {
      title: alert.title,
      body: alert.body,
      // Open the app at this release; the card has the store link.
      url: `/?release=${encodeURIComponent(release.key)}`,
      releaseKey: release.key,
      // A newer alert for the same release replaces the older notification.
      tag: `release-${release.key}`,
      unseenCount,
    });
    return { pushError: null };
  } catch (err) {
    return { pushError: err };
  }
}

/** Deletes alerts older than the retention period. Returns how many went. */
export async function deleteOldAlerts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await db.alert.deleteMany({ where: { sentAt: { lt: cutoff } } });
  return count;
}
