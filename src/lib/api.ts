import { ZodError } from "zod";

export function apiError(reason: unknown) {
  if (reason instanceof ZodError) {
    return Response.json({ error: "Invalid request", details: reason.flatten() }, { status: 400 });
  }
  const message = reason instanceof Error ? reason.message : "Unexpected server error";
  const status = /not configured|not found/i.test(message) ? 404 : /permission|denied|not authorized/i.test(message) ? 403 : 500;
  return Response.json({ error: message }, { status });
}

