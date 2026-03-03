import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "../../../../lib/supabase";
import { generateDailySnapshot } from "../../../../lib/snapshotEngine";

export async function GET() {
  try {
    const supabase = createServiceSupabaseClient();

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: true });

    if (projectsError) {
      console.error("Error loading projects for daily cron", { projectsError });
      return NextResponse.json(
        { error: "Failed to load projects for daily snapshot job." },
        { status: 500 }
      );
    }

    const allProjects = projects ?? [];

    const results: {
      projectId: string;
      projectName: string;
      snapshotDate?: string;
      totalWallets?: number;
      inserted?: number;
      skippedExisting?: number;
      error?: string;
    }[] = [];

    for (const project of allProjects) {
      try {
        const res = await generateDailySnapshot(project.id);
        results.push({
          projectId: project.id,
          projectName: project.name,
          snapshotDate: res.snapshotDate,
          totalWallets: res.totalWallets,
          inserted: res.inserted,
          skippedExisting: res.skippedExisting
        });
        console.log("Daily snapshot job completed for project", {
          projectId: project.id,
          projectName: project.name,
          snapshotDate: res.snapshotDate,
          totalWallets: res.totalWallets,
          inserted: res.inserted,
          skippedExisting: res.skippedExisting
        });
      } catch (error) {
        console.error("Daily snapshot job failed for project", {
          projectId: project.id,
          projectName: project.name,
          error
        });
        results.push({
          projectId: project.id,
          projectName: project.name,
          error: "Failed to generate daily snapshot for this project."
        });
      }
    }

    return NextResponse.json(
      {
        ranAt: new Date().toISOString(),
        projectCount: allProjects.length,
        results
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error running daily snapshot cron endpoint", error);
    return NextResponse.json(
      { error: "Failed to run daily snapshot cron job." },
      { status: 500 }
    );
  }
}

