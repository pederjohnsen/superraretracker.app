import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";
import { isValidDevice, savePushSubscription } from "@/lib/push-subscriptions";

// One test per device this often. Kept in memory, so it's per server instance:
// enough to stop a held-down button, not a hard limit.
const TEST_COOLDOWN_MS = 15_000;
const lastTestAt = new Map<string, number>();

/**
 * POST /api/subscriptions/test - sends a test alert to this device through the
 * same push path as stock alerts, so it proves the whole route works: the
 * server's keys, the browser's push service and the service worker.
 * It also saves the device's subscription, so alerts can reach it from now on.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !isValidDevice(body as Record<string, unknown>)) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }
  const { clientId, endpoint, keys } = body as Record<string, unknown> & Parameters<typeof savePushSubscription>[0];

  const now = Date.now();
  const last = lastTestAt.get(endpoint);
  if (last && now - last < TEST_COOLDOWN_MS) {
    return NextResponse.json({ error: "A test alert was just sent. Try again in a few seconds." }, { status: 429 });
  }
  lastTestAt.set(endpoint, now);

  await savePushSubscription({ clientId, endpoint, keys });

  try {
    await sendPushNotification(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      {
        title: "Test alert",
        body: "Notifications are working. Stock alerts from Super Rare Tracker will arrive like this.",
        url: "/",
      },
    );
  } catch (err) {
    console.error("Failed to send a test alert:", err);
    return NextResponse.json({ error: "Your device's push service didn't accept the test alert. Check your notification settings, then try again." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
