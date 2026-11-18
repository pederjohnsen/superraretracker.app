import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// More than the app could have unseen in 30 days, but stops silly requests.
const MAX_ALERTS_PER_REQUEST = 500;

type MarkSeenBody = { clientId?: string; endpoint?: string; alertIds: string[] };

function isValidBody(body: unknown): body is MarkSeenBody {
  if (typeof body !== "object" || body === null) return false;
  const { clientId, endpoint, alertIds } = body as Record<string, unknown>;
  const hasClientId = typeof clientId === "string" && clientId.length > 0;
  const hasEndpoint = typeof endpoint === "string" && endpoint.length > 0;
  if (!hasClientId && !hasEndpoint) return false;
  if (clientId !== undefined && typeof clientId !== "string") return false;
  if (endpoint !== undefined && typeof endpoint !== "string") return false;
  return (
    Array.isArray(alertIds) &&
    alertIds.length > 0 &&
    alertIds.length <= MAX_ALERTS_PER_REQUEST &&
    alertIds.every((id) => typeof id === "string" && id.length > 0)
  );
}

/**
 * POST /api/alerts/seen - marks alerts as seen once the app has shown them.
 * Only this device's own alerts are touched, so another device's ids do nothing.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { clientId, endpoint, alertIds } = body;
  // Found by client id first (the browser can hand out a new endpoint), then by endpoint.
  const device =
    (clientId ? await db.pushSubscription.findFirst({ where: { clientId }, select: { id: true } }) : null) ??
    (endpoint ? await db.pushSubscription.findUnique({ where: { endpoint }, select: { id: true } }) : null);
  if (!device) {
    return NextResponse.json({ success: true, marked: 0 });
  }

  const { count } = await db.alert.updateMany({
    where: { id: { in: alertIds }, pushSubscriptionId: device.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  return NextResponse.json({ success: true, marked: count });
}
