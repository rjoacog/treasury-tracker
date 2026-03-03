import { NextResponse } from "next/server";
import {
  generateDailySnapshot,
  backfillSnapshots
} from "../../../../lib/snapshotEngine";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const projectId = body?.projectId as string | undefined;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'projectId' in request body." },
        { status: 400 }
      );
    }

    const dailyResult = await generateDailySnapshot(projectId);
    const backfillResult = await backfillSnapshots(projectId, 7);

    return NextResponse.json(
      {
        projectId,
        snapshotDate: dailyResult.snapshotDate,
        daily: {
          walletsProcessed: dailyResult.totalWallets,
          snapshotsCreated: dailyResult.inserted,
          walletsSkippedExisting: dailyResult.skippedExisting
        },
        backfill: backfillResult
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error running snapshot endpoint", error);
    return NextResponse.json(
      { error: "Failed to run daily snapshot." },
      { status: 500 }
    );
  }
}

