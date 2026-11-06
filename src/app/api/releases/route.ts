import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStockLiveAt } from "@/lib/launch";
import { parseReleaseTitle } from "@/lib/release-title";

export async function GET() {
  const releases = await db.release.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      // The latest successful reading, for "Checked 4 min ago" on the card.
      stockChecks: { orderBy: { checkedAt: "desc" }, take: 1, select: { checkedAt: true } },
    },
  });

  const now = new Date();
  return NextResponse.json(
    releases.map(({ stockChecks, ...release }) => {
      const stockLiveAt = getStockLiveAt(release.releaseDate, release.preOrderCloseDate);
      const parsed = parseReleaseTitle(release.name);
      return {
        ...release,
        // The parts the card shows: saved ones when set (they can be corrected
        // by hand), otherwise split from the store title.
        ...parsed,
        ...(release.title && { title: release.title, catalogue: release.catalogue, edition: release.edition }),
        lastCheckedAt: stockChecks[0]?.checkedAt ?? null,
        // Only while still ahead: "Stock goes live 12 Nov, 18:00".
        stockLiveAt: stockLiveAt > now ? stockLiveAt : null,
      };
    }),
  );
}
