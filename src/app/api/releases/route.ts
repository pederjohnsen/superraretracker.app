import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const releases = await db.release.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(releases);
}
