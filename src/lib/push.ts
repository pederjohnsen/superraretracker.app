import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription as WebPushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { db } from "@/lib/db";

const vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const vapidSubject = process.env.WEB_PUSH_VAPID_SUBJECT ?? "mailto:admin@superraretracker.app";

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushNotification(
  subscription: PushSubscriptionKeys,
  payload: PushNotificationPayload,
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY are not configured");
  }

  const vapid: VapidKeys = {
    subject: vapidSubject,
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
  };

  const webPushSubscription: WebPushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  const message: PushMessage = {
    data: JSON.stringify(payload),
    options: {
      urgency: "high",
      ttl: 60,
    },
  };

  const requestInit = await buildPushPayload(message, webPushSubscription, vapid);
  const res = await fetch(subscription.endpoint, requestInit);

  if (!res.ok) {
    if (res.status === 404 || res.status === 410) {
      // Browser has revoked this subscription; stop trying to notify it.
      await db.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
    }
    throw new Error(`Push service responded with ${res.status} for ${subscription.endpoint}`);
  }
}
