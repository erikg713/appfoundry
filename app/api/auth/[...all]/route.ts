import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * App Router route handlers for /api/auth/[...all]
 *
 * Improvements:
 * - Dynamic CORS (use ALLOWED_AUTH_ORIGINS env var in production)
 * - 405 for unsupported methods
 * - Verify handler methods exist before calling
 * - Attach CORS headers to the handler's Response
 * - Improved error logging (structured)
 *
 * Notes:
 * - Set ALLOWED_AUTH_ORIGINS="https://yourapp.com,https://admin.yourapp.com" in production.
 * - Optionally export `export const runtime = 'edge'` if Better Auth requires edge runtime.
 */

const handler = toNextJsHandler(auth);

// Set a comma-separated list of allowed origins in production.
// Defaults are permissive for local dev (localhost).
const ALLOWED_ORIGINS = (process.env.ALLOWED_AUTH_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000").split(",").map((s) => s.trim()).filter(Boolean);

/** Return CORS headers for a specific origin (or null if origin not allowed). */
function buildCorsHeaders(origin?: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };

  if (!origin) {
    // no Origin header — do not set Access-Control-Allow-Origin in production
    return headers;
  }

  if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin) || (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export const OPTIONS = async (req: Request) => {
  try {
    const origin = req.headers.get("origin");
    const cors = buildCorsHeaders(origin);
    return new Response(null, { status: 204, headers: cors });
  } catch (err) {
    console.error(JSON.stringify({ msg: "Auth OPTIONS error", err: String(err) }));
    return new Response("Internal Server Error", { status: 500 });
  }
};

async function callHandlerMethod(methodName: "GET" | "POST", req: Request) {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin);

  const method = (handler as any)?.[methodName];
  if (typeof method !== "function") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  try {
    const res: Response = await method.call(handler, req);

    // Merge/attach CORS headers to the handler response
    const outHeaders = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) {
      if (v !== undefined) outHeaders.set(k, v);
    }

    // Copy body stream safely
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    });
  } catch (err: any) {
    // Replace with a proper structured logger / Sentry in prod
    console.error(JSON.stringify({ msg: `Auth ${methodName} handler error`, error: err?.stack ?? String(err) }));
    const outHeaders = new Headers(cors);
    return new Response("Internal Server Error", { status: 500, headers: outHeaders });
  }
}

export const GET = async (req: Request) => callHandlerMethod("GET", req);
export const POST = async (req: Request) => callHandlerMethod("POST", req);

/**
 * Optional:
 * If your auth SDK requires Edge runtime, uncomment:
 *
 * export const runtime = "edge";
 */
export const POST = async (req: Request) => {
  try {
    return await handler.POST(req);
  } catch (err) {
    console.error("Auth POST handler error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
