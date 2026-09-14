import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_SUBSCRIPTIONS_PER_REQUEST = 200;

type SubscriptionInput = {
  releaseId: string;
  thresholdPercentage: number;
};

type SyncSubscriptionsBody = {
  clientId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  subscriptions: SubscriptionInput[];
};

function isValidBody(body: unknown): body is SyncSubscriptionsBody {
  if (typeof body !== "object" || body === null) return false;
  const { clientId, endpoint, keys, subscriptions } = body as Record<string, unknown>;

  if (typeof clientId !== "string" || clientId.length === 0) return false;
  if (typeof endpoint !== "string" || endpoint.length === 0) return false;
  if (typeof keys !== "object" || keys === null) return false;
  const { p256dh, auth } = keys as Record<string, unknown>;
  if (typeof p256dh !== "string" || p256dh.length === 0) return false;
  if (typeof auth !== "string" || auth.length === 0) return false;

  if (!Array.isArray(subscriptions) || subscriptions.length > MAX_SUBSCRIPTIONS_PER_REQUEST) return false;
  return subscriptions.every(
    (sub) =>
      typeof sub === "object" &&
      sub !== null &&
      typeof (sub as Record<string, unknown>).releaseId === "string" &&
      typeof (sub as Record<string, unknown>).thresholdPercentage === "number" &&
      Number.isInteger((sub as Record<string, unknown>).thresholdPercentage),
  );
}

// GET /api/subscriptions?endpoint=... - fetch this device's current per-release alert thresholds.
export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId");
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!clientId && !endpoint) {
    return NextResponse.json({ error: "Missing clientId or endpoint query parameter" }, { status: 400 });
  }

  const pushSubscription = clientId
    ? await db.pushSubscription.findFirst({ where: { clientId }, include: { subscriptions: true } })
    : null;
  const legacyPushSubscription = !pushSubscription && endpoint
    ? await db.pushSubscription.findUnique({ where: { endpoint }, include: { subscriptions: true } })
    : null;

  const subscriptions = (pushSubscription?.subscriptions ?? legacyPushSubscription?.subscriptions ?? []).map((sub) => ({
    releaseId: sub.releaseId,
    thresholdPercentage: sub.thresholdPercentage,
  }));

  return NextResponse.json({ subscriptions });
}

// POST /api/subscriptions - replace this device's push subscription + release alert set in one call.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { clientId, endpoint, keys, subscriptions } = body;

  const existingByClientId = await db.pushSubscription.findFirst({ where: { clientId } });
  const pushSubscription = existingByClientId
    ? await db.pushSubscription.update({
        where: { id: existingByClientId.id },
        data: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      })
    : await db.pushSubscription.upsert({
        where: { endpoint },
        create: { clientId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        update: { clientId, p256dh: keys.p256dh, auth: keys.auth },
      });

  const existing = await db.releaseSubscription.findMany({
    where: { pushSubscriptionId: pushSubscription.id },
  });
  const existingByReleaseId = new Map(existing.map((sub) => [sub.releaseId, sub]));
  const incomingReleaseIds = new Set(subscriptions.map((sub) => sub.releaseId));

  const toDelete = existing.filter((sub) => !incomingReleaseIds.has(sub.releaseId)).map((sub) => sub.id);
  if (toDelete.length > 0) {
    await db.releaseSubscription.deleteMany({ where: { id: { in: toDelete } } });
  }

  for (const sub of subscriptions) {
    const current = existingByReleaseId.get(sub.releaseId);
    if (!current) {
      await db.releaseSubscription.create({
        data: {
          releaseId: sub.releaseId,
          pushSubscriptionId: pushSubscription.id,
          thresholdPercentage: sub.thresholdPercentage,
        },
      });
    } else if (current.thresholdPercentage !== sub.thresholdPercentage) {
      // Threshold changed - clear notifiedAt so a fresh drop below the new threshold can fire again.
      await db.releaseSubscription.update({
        where: { id: current.id },
        data: { thresholdPercentage: sub.thresholdPercentage, notifiedAt: null },
      });
    }
  }

  return NextResponse.json({ success: true });
}
