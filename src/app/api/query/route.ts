import { z } from "zod";
import { apiError } from "@/lib/api";
import { executeSql, isDestructiveSql } from "@/lib/db/queries";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  connectionId: z.string().min(1),
  sql: z.string().trim().min(1).max(1_000_000),
  timeoutMs: z.number().int().min(1_000).max(120_000).default(30_000),
  confirmDestructive: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "Login required." }, { status: 401 });
  try {
    const input = requestSchema.parse(await request.json());
    if (isDestructiveSql(input.sql) && !input.confirmDestructive) {
      return Response.json({
        error: "This query contains a potentially destructive operation.",
        code: "DESTRUCTIVE_CONFIRMATION_REQUIRED",
      }, { status: 409 });
    }
    return Response.json(await executeSql(input.connectionId, input.sql, input.timeoutMs));
  } catch (reason) {
    return apiError(reason);
  }
}
