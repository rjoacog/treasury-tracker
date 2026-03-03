import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const projectId = formData.get("projectId");

  const redirectUrl = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (typeof projectId === "string" && projectId) {
    response.cookies.set("tt_project_id", projectId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });
  }

  return response;
}

