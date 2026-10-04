import { z } from "zod";
import { apiError } from "@/lib/api";
import { discoverDatabases, getDatabaseDiagram, getOverview, getResource, getTableDetails, listTables } from "@/lib/db/queries";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  connectionId: z.string().min(1),
  resource: z.enum(["overview", "databases", "tables", "diagram", "schemas", "views", "functions", "indexes", "extensions", "roles", "activity", "relationships", "table"]),
  schema: z.string().min(1).max(128).optional(),
  table: z.string().min(1).max(128).optional(),
});

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "Login required." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const input = querySchema.parse(Object.fromEntries(url.searchParams));
    if (input.resource === "overview") return Response.json(await getOverview(input.connectionId));
    if (input.resource === "databases") return Response.json({ rows: await discoverDatabases(input.connectionId) });
    if (input.resource === "tables") return Response.json({ rows: await listTables(input.connectionId) });
    if (input.resource === "diagram") return Response.json(await getDatabaseDiagram(input.connectionId));
    if (input.resource === "table") {
      if (!input.schema || !input.table) return Response.json({ error: "Schema and table are required." }, { status: 400 });
      return Response.json(await getTableDetails(input.connectionId, input.schema, input.table));
    }
    return Response.json(await getResource(input.connectionId, input.resource));
  } catch (reason) {
    return apiError(reason);
  }
}
