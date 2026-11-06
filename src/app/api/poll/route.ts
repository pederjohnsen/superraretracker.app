import { isCronAuthorized } from "@/lib/cron-auth";
import { runPollingCycle } from "@/lib/poller";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await runPollingCycle();
  return Response.json({
    success: true,
  });
}
