import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * App Router route handlers for /api/auth/[...all]
 *
 * - We create a single handler instance (handler) once at module load.
 * - Wrap GET/POST in try/catch to log and return a controlled 500 on unexpected errors.
 * - Provide an OPTIONS handler for CORS preflight (enable only if required).
 *
 * Notes:
 * - If `toNextJsHandler` already implements its own error handling, the try/catch is optional.
 * - If your auth library requires a particular runtime (edge/node), export `export const runtime = 'edge'` accordingly.
 */
const handler = toNextJsHandler(auth);

// OPTIONAL: CORS preflight support. Remove or tighten the Access-Control-Allow-Origin header in production.
export const OPTIONS = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*", // lock this down to your origin in production
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });

export const GET = async (req: Request) => {
  try {
    return await handler.GET(req);
  } catch (err) {
    // Prefer structured logging in production (pino/winston/sentry)
    console.error("Auth GET handler error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export const POST = async (req: Request) => {
  try {
    return await handler.POST(req);
  } catch (err) {
    console.error("Auth POST handler error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
