import {runPollingCycle} from "@/lib/poller";

export async function GET() {
  await runPollingCycle();
  return Response.json({
    success: true,
  });
}
