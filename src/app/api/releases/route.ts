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
      return {
        ...release,
        // The store title split into the parts the cards show.
        ...parseReleaseTitle(release.name),
        lastCheckedAt: stockChecks[0]?.checkedAt ?? null,
        // Only while still ahead: "Stock goes live 12 Nov, 18:00".
        stockLiveAt: stockLiveAt > now ? stockLiveAt : null,
      };
    }),
  );
}
