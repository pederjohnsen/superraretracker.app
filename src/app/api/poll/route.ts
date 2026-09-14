import { timingSafeEqual } from "node:crypto";
import { runPollingCycle } from "@/lib/poller";

// Accepts either an `Authorization: Bearer <secret>` header or a `?secret=` query
// param, since not every external cron service lets you set custom headers.
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Fail closed: without a configured secret, nobody is authorized.
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  const provided = headerSecret ?? querySecret;

  if (!provided) {
    return false;
  }

  const expected = Buffer.from(cronSecret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await runPollingCycle();
  return Response.json({
    success: true,
  });
}
