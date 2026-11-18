import { deleteOldAlerts } from "@/lib/alerts";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runReleaseMonitor } from "@/lib/monitor/monitor";

// Reading four collections and each new product page takes a few seconds.
export const maxDuration = 60;

/**
 * Adds new releases from the store. Scheduled on cron-job.org just after the
 * 4pm UK announcement; safe to run several times, since known releases are skipped.
 *
 * `?dryRun=1` lists what would be added without saving anything.
 * `?days=30` looks further back than the usual 7 days, for a one-off backfill.
 *
 * It also deletes alerts older than 30 days, since this runs every week.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get("dryRun") === "1" || params.get("dryRun") === "true";
  const days = Number(params.get("days"));
  const maxAgeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : undefined;

  const result = await runReleaseMonitor({ dryRun, maxAgeDays });

  let oldAlertsDeleted = 0;
  if (!dryRun) {
    try {
      oldAlertsDeleted = await deleteOldAlerts();
    } catch (err) {
      result.errors.push(`Failed to delete old alerts: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // A failed collection still reports what the others found, but marks the run as failed for cron-job.org.
  return Response.json({ success: result.errors.length === 0, ...result, oldAlertsDeleted }, { status: result.errors.length ? 502 : 200 });
}
