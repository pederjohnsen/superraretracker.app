import { db } from "@/lib/db";

export type DevicePushSubscription = {
  clientId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Checks the device fields every subscriptions endpoint receives. Push endpoints are always https. */
export function isValidDevice(value: Record<string, unknown>): value is DevicePushSubscription & Record<string, unknown> {
  const { clientId, endpoint, keys } = value;
  if (typeof clientId !== "string" || clientId.length === 0) return false;
  if (typeof endpoint !== "string" || !URL.canParse(endpoint) || new URL(endpoint).protocol !== "https:") return false;
  if (typeof keys !== "object" || keys === null) return false;
  const { p256dh, auth } = keys as Record<string, unknown>;
  return typeof p256dh === "string" && p256dh.length > 0 && typeof auth === "string" && auth.length > 0;
}

/**
 * Saves this device's push subscription, found by its client id first (the
 * browser can hand out a new endpoint) and then by endpoint.
 */
export async function savePushSubscription({ clientId, endpoint, keys }: DevicePushSubscription) {
  const existingByClientId = await db.pushSubscription.findFirst({ where: { clientId } });
  return existingByClientId
    ? db.pushSubscription.update({
        where: { id: existingByClientId.id },
        data: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      })
    : db.pushSubscription.upsert({
        where: { endpoint },
        create: { clientId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        update: { clientId, p256dh: keys.p256dh, auth: keys.auth },
      });
}
