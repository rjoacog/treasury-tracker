import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const rawAddress = body?.address as string | undefined;
    const projectId = body?.projectId as string | undefined;

    if (!rawAddress || typeof rawAddress !== "string" || !projectId) {
      return NextResponse.json(
        { error: "Missing or invalid 'address' or 'projectId' in request body." },
        { status: 400 }
      );
    }

    const address = rawAddress.trim().toLowerCase();

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Ensure project belongs to the logged-in user
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project || project.user_id !== userId) {
      return NextResponse.json({ error: "Project not found for current user." }, { status: 403 });
    }

    // Find Ethereum mainnet network
    const { data: network, error: networkError } = await supabase
      .from("networks")
      .select("id, chain_id")
      .eq("chain_id", 1)
      .single();

    if (networkError || !network) {
      console.error("Error loading Ethereum network", networkError);
      return NextResponse.json(
        { error: "Ethereum network is not configured in the database." },
        { status: 500 }
      );
    }

    const { data, error: insertError } = await supabase
      .from("wallets")
      .insert({
        project_id: projectId,
        address,
        network_id: network.id
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting wallet", insertError);
      const isConflict =
        typeof insertError.code === "string" &&
        (insertError.code === "23505" || insertError.message?.includes("wallets_project_address_network_unique"));

      return NextResponse.json(
        {
          error: isConflict
            ? "This wallet is already added to the project."
            : "Failed to add wallet."
        },
        { status: isConflict ? 409 : 500 }
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/wallets", error);
    return NextResponse.json({ error: "Failed to add wallet." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const walletId = body?.walletId as string | undefined;

    if (!walletId || typeof walletId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'walletId' in request body." },
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

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, project_id")
      .eq("id", walletId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", wallet.project_id)
      .single();

    if (projectError || !project || project.user_id !== userId) {
      return NextResponse.json({ error: "Wallet does not belong to current user." }, { status: 403 });
    }

    const { error: deleteError } = await supabase.from("wallets").delete().eq("id", walletId);

    if (deleteError) {
      console.error("Error deleting wallet", deleteError);
      return NextResponse.json({ error: "Failed to delete wallet." }, { status: 500 });
    }

    // daily_snapshots are deleted automatically via ON DELETE CASCADE on wallet_id

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/wallets", error);
    return NextResponse.json({ error: "Failed to delete wallet." }, { status: 500 });
  }
}

