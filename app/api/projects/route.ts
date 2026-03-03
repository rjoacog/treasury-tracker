import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";

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

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

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
