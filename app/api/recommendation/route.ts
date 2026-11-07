import { NextResponse } from "next/server";
import { isMissingSchema, requireUser } from "@/lib/apiAuth";
import {
  InsufficientProfileError,
  JobBoardsUnavailableError,
  recommendJobs,
} from "@/lib/jobRecommendations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://job-dash-ashy.vercel.app",
  "https://34c9-105-164-69-197.ngrok-free.app",
]);

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "";
  const allowed =
    ALLOWED_ORIGINS.has(origin) || origin.startsWith("chrome-extension://");
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(req),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;

    // job_description is added by a migration that is not on every database yet.
    // PostgREST rejects the whole query when a selected column is missing.
    let { data: apps, error } = await auth.supabase
      .from("job_applications")
      .select("company, role, resume_data, job_description, date_applied")
      .eq("user_id", auth.user.id);

    if (error?.code === "42703") {
      const fallback = await auth.supabase
        .from("job_applications")
        .select("company, role, resume_data, date_applied")
        .eq("user_id", auth.user.id);
      apps = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("Recommendation DB error:", error);
      return json(
        req,
        { error: "db_error", message: "Could not load your applications." },
        500,
      );
    }

    const { data: profile, error: targetError } = await auth.supabase
      .from("profiles")
      .select("target_roles")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    let targetTitles: string[] = [];
    if (
      targetError &&
      targetError.code !== "42703" &&
      !isMissingSchema(targetError)
    ) {
      console.error("Recommendation target error:", targetError);
      return json(
        req,
        { error: "db_error", message: "Could not load your target roles." },
        500,
      );
    }
    if (!targetError && Array.isArray(profile?.target_roles)) {
      targetTitles = profile.target_roles.filter(
        (role): role is string => typeof role === "string",
      );
    }

    const result = await recommendJobs(
      auth.user.id,
      apps || [],
      targetTitles.map((title) => ({ title })),
    );
    return json(req, result);
  } catch (error) {
    if (error instanceof InsufficientProfileError) {
      return json(
        req,
        { error: "insufficient_profile", message: error.message },
        422,
      );
    }
    if (error instanceof JobBoardsUnavailableError) {
      return json(
        req,
        { error: "boards_unavailable", message: error.message },
        502,
      );
    }
    console.error("Recommendation error:", error);
    return json(
      req,
      { error: "server_error", message: "Could not load recommendations." },
      500,
    );
  }
}
