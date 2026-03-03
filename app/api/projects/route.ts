import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const name = body?.name as string | undefined;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid 'name' in request body." },
        { status: 400 }
      );
    }

    const userId = process.env.DEFAULT_USER_ID;
    if (!userId) {
      return NextResponse.json(
        { error: "Server not configured for project creation (missing DEFAULT_USER_ID)." },
        { status: 503 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: userId, name: name.trim() })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating project", error);
      return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/projects", error);
    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}
