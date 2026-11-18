import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStockLiveAt } from "@/lib/launch";
import { getPublisher, isPublisherKey } from "@/lib/publishers";
import { parseReleaseTitle } from "@/lib/release-title";

// The stock bar can take a little while to appear after launch.
const STOCK_BAR_GRACE_MS = 60 * 60_000;

export async function GET() {
  const releases = await db.release.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      // The latest successful reading, for "Checked 4 min ago" on the card.
      stockChecks: { orderBy: { checkedAt: "desc" }, take: 1, select: { checkedAt: true } },
      pollSchedule: { select: { lastPolledAt: true, intervalMinutes: true } },
    },
  });

  const now = new Date();
  return NextResponse.json(
    releases.map(({ stockChecks, pollSchedule, ...release }) => {
      // A release with an unknown publisher still shows, with Super Rare Games' launch time.
      const publisher = getPublisher(isPublisherKey(release.publisher) ? release.publisher : "super-rare-games");
      const stockLiveAt = getStockLiveAt(publisher.launch, release.releaseDate, release.preOrderCloseDate);
      const parsed = parseReleaseTitle(release.name);
      return {
        ...release,
        // The parts the card shows: saved ones when set (they can be corrected
        // by hand), otherwise split from the store title.
        ...parsed,
        ...(release.title && { title: release.title, catalogue: release.catalogue, edition: release.edition }),
        publisherName: publisher.name,
        lastCheckedAt: stockChecks[0]?.checkedAt ?? null,
        // Only while still ahead: "Stock goes live 12 Nov, 18:00".
        stockLiveAt: stockLiveAt > now ? stockLiveAt : null,
        // Checked since the hour after launch, and the store shows no stock bar for it.
        stockNotShown:
          release.lastStockPercentage === null &&
          pollSchedule?.lastPolledAt != null &&
          pollSchedule.lastPolledAt.getTime() - stockLiveAt.getTime() > STOCK_BAR_GRACE_MS,
      };
    }),
  );
}
